/**
 * The one split in progress (design r1 SP-01..SP-08, sprint 056-DR UI). Module-level, so a request
 * in flight outlives the overlay (a resize unmounts it: SP-07 settles the outcome once, then
 * applies the matching branch). The overlay (`SplitTimeOverlay.svelte`) draws it; TimerWidget
 * opens it and reloads from the server when it closes (`announceCaptureChange('split')`).
 *
 * Writes go through the existing timer endpoints: `POST /api/timer/split` for the left part (one
 * transaction, idempotent by `clientRequestId`, marker first: `split-marker.ts`), then the right
 * part through stop, save, discard or resume (`split-remainder.ts`). Rules: `split-rules.ts`;
 * times: `split-times.ts`.
 */
import type { DataService } from '$lib/services/data-service';
import type { SplitPartContent, SplitTimerInput, SplitTimerResult } from '$lib/services/types';
import { captureDraft } from '$lib/stores/capture-draft.svelte';
import { dispatchTimeEntrySaved } from '$lib/components/weekly/time-entry-events';
import { announceCaptureChange } from './timer-widget-registry.svelte';
import { cascadeIdForSave } from './ontology-cascade';
import { writePendingTimer } from './pending-timer';
import { describeSaveError } from './save-error';
import { resizeDecisionFor, splitActionsFor, type SplitActions, type SplitPhase } from './split-rules';
import { clearSplitMarker, readSplitMarker, splitMarkerFor, writeSplitMarker } from './split-marker';
import { applySplitResult, reconcileSplitMarker, requestFailureOf } from './split-reconcile';
import {
	discardRemainder,
	endMomentAfter,
	remainderEnd,
	remainderStart,
	resumeRemainder,
	returnRemainderToCapture,
	saveRemainder,
	type SplitRemainder
} from './split-remainder';
import {
	blankContent,
	flipContent,
	initialSplitTimes,
	localDateOf,
	localMomentString,
	localTimeOf,
	momentFromLocal,
	partMinutes,
	sameMinute,
	splitTimesProblems,
	type SplitContent,
	type SplitTimes
} from './split-times';

/** The capture being split: always a server draft (a contractless timer cannot be split) */
export type SplitSource = {
	entryId: string;
	date: string;
	startTime: string;
	/** `HH:MM:SS` when the capture is stopped */
	endTime: string | null;
};

export type SplitLeftResult = {
	action: 'saved' | 'discarded';
	start: number;
	end: number;
	minutes: number;
	contractId: string;
	description: string;
};

const CONFLICT_CODES = new Set(['timer_changed', 'not_a_draft', 'expected_start_required']);
const CONFLICT_NOTICE =
	'This timer changed on another device (it was moved, stopped, saved or split there), so nothing was split here. The timer has been reloaded.';
const NETWORK_LEFT_ERROR = "Couldn't reach the server, so the first part may not be saved yet. Retry to finish it.";
const OVERLAP_HINT = 'This start overlaps a saved entry. Press the button again to keep it.';

function partContent(content: SplitContent): SplitPartContent {
	return {
		contractId: content.contractId || null,
		deliverableId: cascadeIdForSave(content.deliverableId) || null,
		workTypeId: cascadeIdForSave(content.workTypeId) || null,
		description: content.description || null
	};
}

export class SplitSession {
	phase = $state<SplitPhase>('closed');
	/** The widget that opened the split draws the overlay */
	ownerWidgetId = $state('');
	times = $state<SplitTimes>({ start: 0, boundary: 0, end: null });
	left = $state<SplitContent>(blankContent());
	right = $state<SplitContent>(blankContent());
	/** Changes on Flip: the cards' cascades are rebuilt for the swapped selections */
	contentVersion = $state(0);
	leftResult = $state<SplitLeftResult | null>(null);
	remainder = $state<SplitRemainder | null>(null);
	leftError = $state('');
	rightError = $state('');
	isStopping = $state(false);
	/** Shown by the widget after the overlay closed for a reason the user did not choose */
	notice = $state('');
	/** The small layout took over (SP-07): the overlay is gone, an answer may still be settling */
	isCollapsing = $state(false);

	#source: SplitSource = { entryId: '', date: '', startTime: '', endTime: null };
	#dataService: DataService | null = null;
	#clientRequestId = '';
	#collapseRequested = false;
	#confirmOverlap = false;

	get isOpen(): boolean {
		return this.phase !== 'closed';
	}

	get rightIsLive(): boolean {
		return this.times.end === null;
	}

	get actions(): SplitActions {
		return splitActionsFor(this.phase, this.rightIsLive);
	}

	/** The original start, for an untouched From */
	get sourceStart(): number {
		return momentFromLocal(this.#source.date, this.#source.startTime);
	}

	open(source: SplitSource, content: SplitContent, dataService: DataService, ownerWidgetId: string, now = Date.now()): void {
		if (this.isOpen) return;
		this.#source = { ...source };
		this.#dataService = dataService;
		// One id per split attempt, reused by every retry of it (SP-08)
		this.#clientRequestId = crypto.randomUUID();
		this.#collapseRequested = false;
		this.#confirmOverlap = false;
		const start = this.sourceStart;
		this.times = initialSplitTimes(start, source.endTime ? endMomentAfter(start, source.endTime) : null, now);
		this.left = { ...content };
		this.right = blankContent();
		this.leftResult = null;
		this.remainder = null;
		this.leftError = '';
		this.rightError = '';
		this.notice = '';
		this.isCollapsing = false;
		this.ownerWidgetId = ownerWidgetId;
		this.phase = 'editing';
	}

	setTimes(times: SplitTimes): void {
		this.times = times;
		this.#confirmOverlap = false;
	}

	flip(): void {
		if (!this.actions.flipAndCancel) return;
		const flipped = flipContent(this.left, this.right);
		this.left = flipped.left;
		this.right = flipped.right;
		this.contentVersion += 1;
	}

	#close(notice = ''): void {
		this.phase = 'closed';
		this.isCollapsing = false;
		this.notice = notice;
		this.isStopping = false;
		this.#collapseRequested = false;
		captureDraft.isResolving = false;
		// Every mounted widget reads the capture again (the unsplit original, or the remainder)
		announceCaptureChange('split');
	}

	/**
	 * Cancel (and Escape, backdrop, a resize before the left is resolved): nothing is created and
	 * the unsplit capture comes back, still running, or stopped if Stop was pressed here. If the
	 * last split request was never answered, the server decides first (SP-08).
	 */
	async cancel(reason: 'user' | 'resize' = 'user'): Promise<void> {
		if (!this.actions.flipAndCancel) return;
		if (readSplitMarker() && this.#dataService) {
			const outcome = await reconcileSplitMarker(this.#dataService, 'cancel');
			if (outcome.kind === 'offline' && reason === 'user') {
				this.leftError = "Can't tell yet whether the first part was saved. Reconnect, then Retry or Cancel.";
				return;
			}
			if (outcome.kind === 'split' || outcome.kind === 'abandoned') {
				this.#close(outcome.kind === 'split' ? 'The first part had already been saved before Cancel; the rest is back in the timer.' : outcome.message);
				return;
			}
		}
		this.#close();
	}

	/** Escape or a backdrop click: a Cancel only while Cancel is offered (SP-06) */
	dismiss(): void {
		if (this.actions.flipAndCancel) void this.cancel('user');
	}

	/** SP-07: the window crossed into the small layout (or the overlay was unmounted) */
	collapseForSmallLayout(): void {
		const decision = resizeDecisionFor(this.phase);
		if (decision !== 'nothing') this.isCollapsing = true;
		if (decision === 'cancel') void this.cancel('resize');
		else if (decision === 'return-remainder') void this.#returnRemainder();
		else if (decision === 'wait') this.#collapseRequested = true;
	}

	#afterSettle(): void {
		if (!this.#collapseRequested) return;
		this.#collapseRequested = false;
		this.collapseForSmallLayout();
	}

	/** Right Stop: freeze the live end now, no save (before or after the left is resolved) */
	async stopRight(): Promise<void> {
		if (!this.actions.rightStop || this.isStopping || !this.#dataService) return;
		this.isStopping = true;
		this.rightError = '';
		try {
			const remainder = this.remainder;
			if (remainder?.kind === 'pending') {
				const endTime = localTimeOf(Date.now());
				writePendingTimer({ date: remainder.date, startTime: remainder.startTime, description: this.right.description, endTime });
				this.remainder = { ...remainder, endTime, durationMinutes: Math.max(1, partMinutes(remainderStart(remainder), endMomentAfter(remainderStart(remainder), endTime))) };
				this.times = { ...this.times, end: remainderEnd(this.remainder) };
				return;
			}
			const stopped = await this.#dataService.stopTimer();
			const endTime = stopped.endTime ?? localTimeOf(Date.now());
			if (remainder) {
				this.remainder = { ...remainder, endTime, durationMinutes: stopped.durationMinutes };
			} else {
				this.#source = { ...this.#source, endTime };
			}
			this.times = { ...this.times, end: endMomentAfter(this.times.start, endTime) };
		} catch (error) {
			this.rightError = describeSaveError(error).replace("Couldn't save", "Couldn't stop");
		} finally {
			this.isStopping = false;
		}
	}

	/** Left Save or Discard: `POST /api/timer/split` (SP-04, SP-08) */
	async resolveLeft(action: 'save' | 'discard'): Promise<void> {
		const dataService = this.#dataService;
		if (!this.actions.leftResolve || captureDraft.isResolving || !dataService) return;
		const problems = splitTimesProblems(this.times, Date.now());
		if (problems.left || problems.right) {
			this.leftError = problems.left || 'Check the second part’s times first';
			return;
		}
		if (action === 'save' && !this.left.contractId) {
			this.leftError = 'Pick a contract';
			return;
		}
		this.phase = 'left-saving';
		captureDraft.isResolving = true;
		this.leftError = '';
		let requestSent = false;
		try {
			if (!sameMinute(this.times.start, this.sourceStart)) {
				// The outer start was edited: move the draft's start first (the split keeps the draft's start)
				const moved = await dataService.adjustTimerStart(
					{ date: localDateOf(this.times.start), startTime: localTimeOf(this.times.start) },
					{ confirmed: this.#confirmOverlap }
				);
				this.#source = { ...this.#source, date: moved.date ?? localDateOf(this.times.start), startTime: moved.startTime ?? localTimeOf(this.times.start) };
				this.times = { ...this.times, start: this.sourceStart };
			}
			const request: SplitTimerInput = {
				entryId: this.#source.entryId,
				expectedStartedAt: `${this.#source.date}T${this.#source.startTime}`,
				// The server's end, not an edited To (that is applied when the right part is saved)
				expectedEndedAt: this.#source.endTime ? localMomentString(endMomentAfter(this.sourceStart, this.#source.endTime)) : null,
				boundary: localMomentString(this.times.boundary),
				clientRequestId: this.#clientRequestId,
				left: action === 'save' ? { action: 'save', ...partContent(this.left), contractId: this.left.contractId } : { action: 'discard' },
				right: partContent(this.right)
			};
			writeSplitMarker(splitMarkerFor(request));
			requestSent = true;
			const result = await dataService.splitTimer(request);
			clearSplitMarker();
			applySplitResult(result);
			this.#applyLeftResult(result);
		} catch (error) {
			this.#handleLeftFailure(error, requestSent);
		} finally {
			captureDraft.isResolving = false;
			this.#afterSettle();
		}
	}

	#handleLeftFailure(error: unknown, requestSent: boolean): void {
		const failure = requestFailureOf(error);
		this.phase = 'editing';
		if (failure.kind === 'network') {
			// No answer: the marker stays, a Retry re-sends the same id (the server splits once)
			this.leftError = requestSent ? NETWORK_LEFT_ERROR : describeSaveError(error);
			return;
		}
		if (requestSent) clearSplitMarker();
		if (failure.kind === 'http' && failure.status === 409 && CONFLICT_CODES.has(failure.code)) {
			this.#close(CONFLICT_NOTICE);
			return;
		}
		if (failure.kind === 'http' && failure.code === 'start_overlaps_entry') {
			this.#confirmOverlap = true;
			this.leftError = OVERLAP_HINT;
			return;
		}
		this.leftError = describeSaveError(error);
	}

	#applyLeftResult(result: SplitTimerResult): void {
		const leftStart = this.times.start;
		if (result.left.action === 'saved') {
			const entry = result.left.entry;
			const start = entry.startTime ? momentFromLocal(entry.date, entry.startTime) : leftStart;
			const end = entry.endTime ? endMomentAfter(start, entry.endTime) : this.times.boundary;
			this.leftResult = { action: 'saved', start, end, minutes: entry.durationMinutes, contractId: entry.contractId ?? this.left.contractId, description: entry.description ?? '' };
		} else {
			const start = momentFromLocal(result.left.date, result.left.startTime);
			const end = endMomentAfter(start, result.left.endTime);
			this.leftResult = { action: 'discarded', start, end, minutes: partMinutes(start, end), contractId: '', description: '' };
		}
		const remainder = result.remainder;
		if (remainder.kind === 'gone') {
			this.#close('This split had already been finished on another device or tab.');
			return;
		}
		this.remainder =
			remainder.kind === 'draft'
				? {
						kind: 'draft',
						entryId: remainder.timer.id,
						date: remainder.timer.date ?? localDateOf(this.times.boundary),
						startTime: remainder.timer.startTime ?? localTimeOf(this.times.boundary),
						endTime: remainder.timer.endTime,
						durationMinutes: remainder.timer.durationMinutes
					}
				: {
						kind: 'pending',
						entryId: '',
						date: remainder.date,
						startTime: remainder.startTime,
						endTime: remainder.endTime,
						durationMinutes: 0
					};
		// The right part now starts at the server's boundary; its From is editable on its own
		// A To edited or frozen in the split is kept; a replay may report a stop made elsewhere
		this.times = { start: leftStart, boundary: remainderStart(this.remainder), end: this.times.end ?? remainderEnd(this.remainder) };
		this.#confirmOverlap = false;
		this.phase = 'resolved';
	}

	/** Right Save, Discard, Resume: each closes the overlay when it succeeds (SP-05) */
	async #runRight(work: (dataService: DataService, remainder: SplitRemainder) => Promise<void>): Promise<boolean> {
		const dataService = this.#dataService;
		const remainder = this.remainder;
		if (!this.actions.rightResolve || captureDraft.isResolving || !dataService || !remainder) return false;
		this.phase = 'right-busy';
		captureDraft.isResolving = true;
		this.rightError = '';
		try {
			await work(dataService, remainder);
			this.#close();
			return true;
		} catch (error) {
			const failure = requestFailureOf(error);
			this.phase = 'resolved';
			if (failure.kind === 'http' && failure.status === 409 && CONFLICT_CODES.has(failure.code)) {
				this.#close(CONFLICT_NOTICE);
			} else if (failure.kind === 'http' && failure.code === 'start_overlaps_entry') {
				this.#confirmOverlap = true;
				this.rightError = OVERLAP_HINT;
			} else {
				this.rightError = describeSaveError(error);
			}
			return false;
		} finally {
			captureDraft.isResolving = false;
			this.#afterSettle();
		}
	}

	/** Right Save: freezes Now if still live, then commits; returns the saved day, or null */
	async saveRight(): Promise<string | null> {
		if (!this.right.contractId) {
			this.rightError = 'Pick a contract';
			return null;
		}
		const problem = splitTimesProblems({ ...this.times, start: this.times.boundary - 1000 }, Date.now()).right;
		if (problem) {
			this.rightError = problem;
			return null;
		}
		let savedDate: string | null = null;
		const saved = await this.#runRight(async (dataService, remainder) => {
			let current = remainder;
			if (this.times.end === null && current.kind === 'draft') {
				const stopped = await dataService.stopTimer();
				current = { ...current, endTime: stopped.endTime, durationMinutes: stopped.durationMinutes };
				this.remainder = current;
				this.times = { ...this.times, end: remainderEnd(current) };
			}
			const end = this.times.end ?? Date.now();
			const result = await saveRemainder(dataService, current, { start: this.times.boundary, end }, this.right, this.#clientRequestId);
			dispatchTimeEntrySaved({ entryId: result.entryId, date: result.date });
			savedDate = result.date;
		});
		return saved ? savedDate : null;
	}

	async discardRight(): Promise<void> {
		await this.#runRight((dataService, remainder) => discardRemainder(dataService, remainder));
	}

	async resumeRight(): Promise<void> {
		const confirmed = this.#confirmOverlap;
		await this.#runRight((dataService, remainder) =>
			resumeRemainder(dataService, remainder, { start: this.times.boundary, end: this.times.end }, this.right, confirmed)
		);
	}

	async #returnRemainder(): Promise<void> {
		const dataService = this.#dataService;
		const remainder = this.remainder;
		if (!dataService || !remainder || this.phase !== 'resolved') return;
		this.phase = 'right-busy';
		await returnRemainderToCapture(dataService, remainder, { start: this.times.boundary, end: this.times.end }, this.right);
		this.#close();
	}
}

export const splitSession = new SplitSession();
