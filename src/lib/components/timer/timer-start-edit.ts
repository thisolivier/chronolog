/**
 * Editing a running timer's start (sprint 041-CL): the browser-side checks, which match the
 * server's (`src/routes/api/timer/timer-start-rules.ts`), and reading the server's refusal.
 */

import { parseClockText } from '$lib/utils/clock-text';

const DAY_SECONDS = 24 * 60 * 60;

export type TimerStartRejection = {
	status: number;
	code: string;
	message: string;
};

/** The local moment of `date` (`YYYY-MM-DD`) at `time` (`HH:MM[:SS]`). */
function localMoment(date: string, time: string): Date {
	const [year, month, day] = date.split('-').map(Number);
	const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
	return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Why a chosen start cannot be used, or null: in the future, or more than a day ago (the
 * server refuses both). A start within the current minute is "now", not the future.
 */
export function localTimerStartProblem(date: string, time: string, now: Date = new Date()): string | null {
	const clockParts = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
	// Shape and range: "12:60" must not roll forward into 13:00 (060-DR review)
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
		!clockParts ||
		Number(clockParts[1]) > 23 ||
		Number(clockParts[2]) > 59 ||
		Number(clockParts[3] ?? 0) > 59
	) {
		return START_TIME_FORMAT_MESSAGE;
	}
	const secondsBeforeNow = (now.getTime() - localMoment(date, time).getTime()) / 1000;
	if (secondsBeforeNow < -60) return 'The start time is in the future.';
	if (secondsBeforeNow > DAY_SECONDS) return 'A timer can start at most 24 hours ago.';
	return null;
}

export const START_TIME_FORMAT_MESSAGE = 'Enter a start time as HH:MM.';

/**
 * What the Started field holds, read for a save (sprint 060-DR): the `HH:MM:SS` start, or the
 * message to show in place. Text the clock parser cannot read never reaches the checks or the save.
 */
export function readTimerStartInput(
	date: string,
	text: string,
	now: Date = new Date()
): { ok: true; clock: string; startTime: string } | { ok: false; error: string } {
	const clock = parseClockText(text);
	if (!clock) return { ok: false, error: START_TIME_FORMAT_MESSAGE };
	const problem = localTimerStartProblem(date, clock, now);
	if (problem) return { ok: false, error: problem };
	return { ok: true, clock, startTime: `${clock}:00` };
}

/** `HH:MM` for a time input, from `HH:MM:SS`. */
export function toTimeInputValue(time: string): string {
	return time ? time.slice(0, 5) : '';
}

/**
 * Status, code and message from a failed `PATCH /api/timer`. The fetch helpers throw
 * `PATCH /api/timer failed (409): {"code":"…","message":"…"}`.
 */
export function readTimerStartRejection(error: unknown): TimerStartRejection {
	const detail = error instanceof Error ? error.message : '';
	const httpFailure = detail.match(/failed \((\d{3})\):\s*([\s\S]*)$/);
	if (!httpFailure) {
		return { status: 0, code: 'network', message: "Couldn't change the start: no connection to the server." };
	}
	try {
		const body = JSON.parse(httpFailure[2]) as { code?: unknown; message?: unknown; error?: unknown };
		const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : '';
		return {
			status: Number(httpFailure[1]),
			code: typeof body.code === 'string' ? body.code : 'error',
			message: message || `Couldn't change the start (error ${httpFailure[1]}).`
		};
	} catch {
		return { status: Number(httpFailure[1]), code: 'error', message: `Couldn't change the start (error ${httpFailure[1]}).` };
	}
}

/** What TimerWidget answers when the start field asks to move the start. */
export type StartChangeResult =
	| { outcome: 'saved' }
	| { outcome: 'overlap'; message: string }
	| { outcome: 'error'; message: string };

/** A failed PATCH as a result for the start field: an overlap asks to confirm, the rest is shown. */
export function startChangeResultFromError(error: unknown): StartChangeResult {
	const rejection = readTimerStartRejection(error);
	if (rejection.code === 'start_overlaps_entry') return { outcome: 'overlap', message: rejection.message };
	return { outcome: 'error', message: rejection.message };
}
