/**
 * The split marker (design r1 SP-08, sprint 056-DR UI): written to localStorage before
 * `POST /api/timer/split` is sent and cleared once a response settles it (200 or an HTTP error).
 * A marker found later means the answer never arrived (reload, crash, lost connection), so the
 * browser cannot know whether the split happened: `reconcileStepFor` decides from the server's
 * current timer, and a re-send with the same `clientRequestId` is replay-safe on the server.
 *
 * Known server gap (sprint 056-DR-api): a split with `left: discard` and a contractless right part
 * deletes the only row, so its retry answers 404 `not_found`. The browser, which knows its own
 * request, treats that 404 as settled and restores the pending remainder from the marker.
 */
import type { SplitTimerInput, TimerEntry } from '$lib/services/types';

export type SplitMarker = {
	clientRequestId: string;
	entryId: string;
	/** `YYYY-MM-DDTHH:MM:SS` */
	boundary: string;
	leftAction: 'save' | 'discard';
	/** The exact request, re-sent as is */
	request: SplitTimerInput;
	/**
	 * The user cancelled (or a resize cancelled) while the answer was unknown: a later load only
	 * finds out what happened and never sends the split again for a draft still unsplit
	 */
	cancelled?: boolean;
};

const STORAGE_KEY = 'chronolog.split-marker';

export function splitMarkerFor(request: SplitTimerInput): SplitMarker {
	return {
		clientRequestId: request.clientRequestId,
		entryId: request.entryId,
		boundary: request.boundary,
		leftAction: request.left.action,
		request
	};
}

export function readSplitMarker(): SplitMarker | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;
		const parsed = JSON.parse(stored) as Partial<SplitMarker>;
		if (
			typeof parsed.clientRequestId !== 'string' ||
			typeof parsed.entryId !== 'string' ||
			typeof parsed.boundary !== 'string' ||
			(parsed.leftAction !== 'save' && parsed.leftAction !== 'discard') ||
			!parsed.request ||
			typeof parsed.request !== 'object'
		) {
			return null;
		}
		return parsed as SplitMarker;
	} catch {
		return null;
	}
}

export function writeSplitMarker(marker: SplitMarker): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(marker));
	} catch {
		// Storage blocked: the request still carries its id, only the reload recovery is lost
	}
}

/** Cancel while the outcome is unknown: keep the marker only to settle what already happened */
export function markSplitMarkerCancelled(): void {
	const marker = readSplitMarker();
	if (marker) writeSplitMarker({ ...marker, cancelled: true });
}

export function clearSplitMarker(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing to clear
	}
}

/** `HH:MM[:SS]` moments compare at the precision of the shorter one (the server's `momentMatches`) */
function sameMoment(a: string, b: string): boolean {
	const length = Math.min(a.length, b.length);
	return a.slice(0, length) === b.slice(0, length);
}

/**
 * What the server's current timer says about an unsettled split:
 * - `split-happened`: the marked draft now starts at the boundary (its remainder);
 * - `not-split`: the marked draft still starts where the request expected;
 * - `unknown`: the draft is gone or is another one (a pending remainder, or resolved elsewhere):
 *   only a re-send can tell (it replays the first outcome, or answers 404).
 */
export function reconcileStepFor(marker: SplitMarker, timer: TimerEntry | null): 'split-happened' | 'not-split' | 'unknown' {
	if (!timer || timer.id !== marker.entryId || !timer.date || !timer.startTime) return 'unknown';
	const draftStart = `${timer.date}T${timer.startTime}`;
	if (sameMoment(draftStart, marker.boundary)) return 'split-happened';
	if (sameMoment(draftStart, marker.request.expectedStartedAt)) return 'not-split';
	return 'unknown';
}

/**
 * A re-send that failed with an HTTP status: 404 after `left: discard` with a contractless right
 * part is the known gap (the first request did split); anything else means it cannot be finished.
 */
export function resendFailureMeaning(marker: SplitMarker, status: number): 'settled-known-gap' | 'abandoned' {
	const rightHasContract = Boolean(marker.request.right?.contractId);
	return status === 404 && marker.leftAction === 'discard' && !rightHasContract ? 'settled-known-gap' : 'abandoned';
}
