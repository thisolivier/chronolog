/**
 * The right part after the left is resolved (SP-05, SP-07): the remainder is either the server
 * draft (it kept a contract) or the browser's pending timer (no contract: source map §a6). These
 * functions finish it through the ordinary timer paths; `split-session.svelte.ts` calls them.
 */
import type { DataService } from '$lib/services/data-service';
import { captureKeyFor, intervalKeyFor } from '$lib/stores/capture-draft';
import { captureDraft } from '$lib/stores/capture-draft.svelte';
import { formatDurationInput } from '$lib/utils/duration';
import { cascadeIdForSave } from './ontology-cascade';
import { clearPendingTimer, writePendingTimer } from './pending-timer';
import { localDateOf, localTimeOf, momentFromLocal, partMinutes, type SplitContent } from './split-times';

export type SplitRemainder = {
	kind: 'draft' | 'pending';
	/** '' for a pending remainder */
	entryId: string;
	date: string;
	/** `HH:MM:SS`, as stored */
	startTime: string;
	/** `HH:MM:SS` once stopped */
	endTime: string | null;
	/** The stored (rounded-up) duration of a stopped remainder */
	durationMinutes: number;
};

/** The right part's times as the card shows them: `start` (its From) and `end` (null: live) */
export type RightTimes = { start: number; end: number | null };

export function remainderStart(remainder: SplitRemainder): number {
	return momentFromLocal(remainder.date, remainder.startTime);
}

/** The server's start guard for this remainder */
export function remainderExpectedStart(remainder: SplitRemainder): string {
	return `${remainder.date}T${remainder.startTime}`;
}

/** An end `HH:MM:SS` after `start`, crossing midnight when it reads earlier */
export function endMomentAfter(start: number, endTime: string): number {
	let end = momentFromLocal(localDateOf(start), endTime);
	if (end < start) end += 24 * 60 * 60 * 1000;
	return end;
}

export function remainderEnd(remainder: SplitRemainder): number | null {
	return remainder.endTime ? endMomentAfter(remainderStart(remainder), remainder.endTime) : null;
}

function sameSecond(a: number | null, b: number | null): boolean {
	if (a === null || b === null) return a === b;
	return Math.floor(a / 1000) === Math.floor(b / 1000);
}

function contentPatch(content: SplitContent) {
	return {
		description: content.description,
		...(content.contractId
			? {
					contractId: content.contractId,
					deliverableId: cascadeIdForSave(content.deliverableId) || null,
					workTypeId: cascadeIdForSave(content.workTypeId) || null
				}
			: {})
	};
}

/** Save the right part (needs a contract); returns the saved entry and the date it is filed under */
export async function saveRemainder(
	dataService: DataService,
	remainder: SplitRemainder,
	times: { start: number; end: number },
	content: SplitContent,
	clientRequestId: string
): Promise<{ date: string; entryId: string }> {
	const deliverableId = cascadeIdForSave(content.deliverableId);
	const workTypeId = cascadeIdForSave(content.workTypeId);
	if (remainder.kind === 'pending') {
		const date = localDateOf(times.start);
		const created = await dataService.createTimeEntry({
			clientRequestId: `${clientRequestId}:right`,
			date,
			contractId: content.contractId,
			deliverableId: deliverableId || null,
			workTypeId: workTypeId || null,
			description: content.description.trim() || undefined,
			durationMinutes: Math.max(1, partMinutes(times.start, times.end)),
			startTime: localTimeOf(times.start),
			endTime: localTimeOf(times.end)
		});
		clearPendingTimer();
		return { date, entryId: created.id };
	}
	const timesEdited = !sameSecond(times.start, remainderStart(remainder)) || !sameSecond(times.end, remainderEnd(remainder));
	await dataService.saveTimer({
		entryId: remainder.entryId,
		contractId: content.contractId,
		deliverableId,
		workTypeId,
		description: content.description,
		expectedStartedAt: remainderExpectedStart(remainder),
		...(timesEdited
			? {
					durationMinutes: Math.max(1, partMinutes(times.start, times.end)),
					startTime: localTimeOf(times.start),
					endTime: localTimeOf(times.end)
				}
			: {})
	});
	return { date: remainder.date, entryId: remainder.entryId };
}

export async function discardRemainder(dataService: DataService, remainder: SplitRemainder): Promise<void> {
	if (remainder.kind === 'pending') {
		clearPendingTimer();
		return;
	}
	await dataService.discardTimer(remainder.entryId, { expectedStartedAt: remainderExpectedStart(remainder) });
}

/** A browser-only remainder runs again from `start`: on the server if a contract is chosen */
async function runPendingFrom(dataService: DataService, start: number, content: SplitContent): Promise<void> {
	const localStart = { date: localDateOf(start), startTime: localTimeOf(start) };
	if (!content.contractId) {
		writePendingTimer({ ...localStart, description: content.description });
		return;
	}
	const timer = await dataService.startTimer(content.contractId, localStart);
	clearPendingTimer();
	await dataService.updateTimeEntry(timer.id, contentPatch(content));
}

/**
 * Resume (SP-05): the unsaved right part becomes ordinary active capture from its configured start,
 * through now (editing time included). Its content goes with it.
 */
export async function resumeRemainder(
	dataService: DataService,
	remainder: SplitRemainder,
	times: RightTimes,
	content: SplitContent,
	confirmed: boolean
): Promise<void> {
	if (remainder.kind === 'pending') {
		await runPendingFrom(dataService, times.start, content);
		return;
	}
	const startEdited = !sameSecond(times.start, remainderStart(remainder));
	const localStart = { date: localDateOf(times.start), startTime: localTimeOf(times.start) };
	if (remainder.endTime) {
		await dataService.resumeTimer({
			start: startEdited ? localStart : undefined,
			confirmed,
			expectedStartedAt: remainderExpectedStart(remainder)
		});
	} else if (startEdited) {
		await dataService.adjustTimerStart(localStart, { confirmed });
	}
	await dataService.updateTimeEntry(remainder.entryId, contentPatch(content));
}

/**
 * SP-07 after the left is resolved: the remainder goes back to ordinary capture as it is (running
 * stays running, stopped stays stopped: never Resume), with the right card's fields. Best effort:
 * a failure leaves the server's remainder as it was, which the widget then shows.
 */
export async function returnRemainderToCapture(
	dataService: DataService,
	remainder: SplitRemainder,
	times: RightTimes,
	content: SplitContent
): Promise<void> {
	const stopped = remainder.endTime !== null && times.end !== null;
	if (!stopped) {
		if (remainder.kind === 'pending') {
			await runPendingFrom(dataService, remainderStart(remainder), content).catch(() => undefined);
		} else {
			await dataService.updateTimeEntry(remainder.entryId, contentPatch(content)).catch(() => undefined);
		}
		return;
	}
	if (remainder.kind === 'pending') {
		writePendingTimer({ date: remainder.date, startTime: remainder.startTime, description: content.description, endTime: remainder.endTime ?? undefined });
	} else {
		await dataService.updateTimeEntry(remainder.entryId, contentPatch(content)).catch(() => undefined);
	}
	// The completion form opens on this capture's key and interval: the right card's fields win
	const start = remainderStart(remainder);
	const end = remainderEnd(remainder) as number;
	const durationMinutes = remainder.kind === 'pending' ? Math.max(1, partMinutes(start, end)) : remainder.durationMinutes;
	const measuredTimeText = formatDurationInput(durationMinutes, remainder.startTime, remainder.endTime);
	const timesEdited = !sameSecond(times.start, start) || !sameSecond(times.end, end);
	const timeText = timesEdited
		? formatDurationInput(partMinutes(times.start, times.end as number), localTimeOf(times.start), localTimeOf(times.end as number))
		: measuredTimeText;
	const fields = { ...content, timeText, measuredTimeText };
	captureDraft.open(
		captureKeyFor({ entryId: remainder.entryId, date: remainder.date, startTime: remainder.startTime }),
		intervalKeyFor({ date: remainder.date, startTime: remainder.startTime, endTime: remainder.endTime ?? '', durationMinutes }),
		fields
	);
	// A widget that mounted meanwhile (the small layout) may have opened this capture already
	captureDraft.fields = fields;
	captureDraft.persist();
}
