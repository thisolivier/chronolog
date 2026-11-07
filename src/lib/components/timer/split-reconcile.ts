/**
 * Settling a split whose answer never arrived (design r1 SP-08, sprint 056-DR UI), from the
 * marker in `split-marker.ts`. Run when a widget loads the timer (a reload, a remount) and when
 * Cancel or a resize closes a split whose last request is unsettled.
 *
 * - The marked draft starts at the boundary: the split happened; its remainder is ordinary capture.
 * - The draft still starts where the request expected: on load, re-send with the same id (the user
 *   had asked for this split; the server performs it once); on Cancel, nothing happened: forget it.
 * - The draft is gone or another one: re-send; the server replays the first outcome. A 404 after
 *   `left: discard` with a contractless right part is the known gap: settled, and the pending
 *   remainder is restored from the marker if the browser had not written it yet.
 * - No connection: keep the marker for the next load.
 */
import type { DataService } from '$lib/services/data-service';
import type { SplitTimerInput, SplitTimerResult } from '$lib/services/types';
import { HttpError } from '$lib/services/fetch-helpers';
import { NotAvailableOfflineError } from '$lib/offline/online-only';
import { isOfflineError } from '$lib/offline/replay-transport';
import { dispatchTimeEntrySaved } from '$lib/components/weekly/time-entry-events';
import { captureDraft } from '$lib/stores/capture-draft.svelte';
import { readPendingTimer, writePendingTimer } from './pending-timer';
import { clearSplitMarker, readSplitMarker, reconcileStepFor, resendFailureMeaning } from './split-marker';

/** How a request failed: no answer, or an HTTP status with the server's `code` */
export type RequestFailure = { kind: 'network' } | { kind: 'http'; status: number; code: string } | { kind: 'other' };

export function requestFailureOf(error: unknown): RequestFailure {
	if (error instanceof NotAvailableOfflineError || isOfflineError(error)) return { kind: 'network' };
	if (error instanceof HttpError) {
		const body = error.message.match(/failed \(\d{3}\):\s*([\s\S]*)$/)?.[1] ?? '';
		let code = '';
		try {
			const parsed = JSON.parse(body) as { code?: unknown };
			code = typeof parsed.code === 'string' ? parsed.code : '';
		} catch {
			// Not JSON: no code
		}
		return { kind: 'http', status: error.status, code };
	}
	return { kind: 'other' };
}

/**
 * Apply a settled split in the browser: a contractless remainder becomes the pending timer, the
 * timesheet hears about a saved left part, and the original capture's completion fields (which
 * described the whole interval) are forgotten.
 */
export function applySplitResult(result: SplitTimerResult): void {
	if (result.remainder.kind === 'pending') {
		writePendingTimer({
			date: result.remainder.date,
			startTime: result.remainder.startTime,
			description: result.remainder.description ?? '',
			endTime: result.remainder.endTime ?? undefined
		});
	}
	if (result.left.action === 'saved') {
		dispatchTimeEntrySaved({ entryId: result.left.entry.id, date: result.left.entry.date });
	}
	captureDraft.clear();
}

/** The known gap: the remainder the server reported in an answer that was lost */
function restorePendingRemainder(request: SplitTimerInput): void {
	if (readPendingTimer()) return;
	const [date, startTime] = request.boundary.split('T');
	const endTime = request.expectedEndedAt ? request.expectedEndedAt.split('T')[1] : undefined;
	writePendingTimer({ date, startTime, description: request.right?.description ?? '', endTime });
	captureDraft.clear();
}

export type ReconcileOutcome =
	| { kind: 'none' }
	| { kind: 'not-split' }
	| { kind: 'split'; message: string }
	| { kind: 'abandoned'; message: string }
	| { kind: 'offline' };

const FINISHED_MESSAGE = 'A split that was interrupted has been finished: the first part is resolved and the rest is in the timer.';

export async function reconcileSplitMarker(dataService: DataService, mode: 'load' | 'cancel'): Promise<ReconcileOutcome> {
	const marker = readSplitMarker();
	if (!marker) return { kind: 'none' };
	let step: ReturnType<typeof reconcileStepFor>;
	try {
		step = reconcileStepFor(marker, (await dataService.getTimerStatus()).timer);
	} catch {
		return { kind: 'offline' };
	}
	if (step === 'split-happened') {
		clearSplitMarker();
		captureDraft.clear();
		return { kind: 'split', message: FINISHED_MESSAGE };
	}
	if (step === 'not-split' && mode === 'cancel') {
		clearSplitMarker();
		return { kind: 'not-split' };
	}
	try {
		const result = await dataService.splitTimer(marker.request);
		clearSplitMarker();
		applySplitResult(result);
		return { kind: 'split', message: FINISHED_MESSAGE };
	} catch (error) {
		const failure = requestFailureOf(error);
		if (failure.kind === 'network') return { kind: 'offline' };
		clearSplitMarker();
		if (failure.kind === 'http' && resendFailureMeaning(marker, failure.status) === 'settled-known-gap') {
			restorePendingRemainder(marker.request);
			return { kind: 'split', message: FINISHED_MESSAGE };
		}
		return {
			kind: 'abandoned',
			message: 'A split that was interrupted could not be finished (the timer changed since). The timer has been reloaded.'
		};
	}
}

/** One reconcile per page at a time, shared by every widget that loads */
let reconcileInFlight: Promise<ReconcileOutcome> | null = null;
export function reconcileOnLoad(dataService: DataService): Promise<ReconcileOutcome> {
	if (!readSplitMarker()) return Promise.resolve({ kind: 'none' });
	reconcileInFlight ??= reconcileSplitMarker(dataService, 'load').finally(() => {
		reconcileInFlight = null;
	});
	return reconcileInFlight;
}
