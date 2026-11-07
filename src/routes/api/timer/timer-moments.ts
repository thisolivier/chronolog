/**
 * Pure wall-clock rules for a draft timer's interval (design r1, sprint 056-DR): the
 * `expectedStartedAt` check, where a split boundary may fall, and how far a stopped draft's start
 * may move. Moments are the user's local `YYYY-MM-DD` + `HH:MM:SS`, compared as in
 * `timer-start-rules.ts` (read as UTC; only differences matter). A draft is dated by its start; an
 * end time earlier than the start time is on the next day (sprint 030), so a draft spans < 24 h.
 */
import { isCalendarDate } from '$lib/utils/local-calendar';
import { readLocalTime } from './local-clock';
import { FUTURE_TOLERANCE_SECONDS, MAXIMUM_TIMER_SECONDS, wallClockSeconds, type LocalMoment } from './timer-start-rules';

/** `HH:MM` → `HH:MM:00`; `HH:MM:SS` unchanged. */
export function fullTime(time: string): string {
	return time.length === 5 ? `${time}:00` : time;
}

/** `YYYY-MM-DDTHH:MM[:SS]` (no zone: the caller's wall clock) → a moment, or null when malformed. */
export function parseLocalMoment(value: unknown): LocalMoment | null {
	if (typeof value !== 'string') return null;
	const [date, time, ...rest] = value.split('T');
	if (rest.length > 0 || !date || !isCalendarDate(date)) return null;
	const validTime = readLocalTime(time);
	return validTime ? { date, time: fullTime(validTime) } : null;
}

/** The `YYYY-MM-DDTHH:MM:SS` text of a moment (the shape `expectedStartedAt` is sent in). */
export function localMomentText(moment: LocalMoment): string {
	return `${moment.date}T${fullTime(moment.time)}`;
}

export function sameMoment(first: LocalMoment, second: LocalMoment): boolean {
	return localMomentText(first) === localMomentText(second);
}

export function nextDate(date: string): string {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export type DraftTimes = { date: string; startTime: string | null; endTime: string | null };

/** Where the draft started, or null for a row without a start time. */
export function draftStartMoment(draft: DraftTimes): LocalMoment | null {
	return draft.startTime ? { date: draft.date, time: fullTime(draft.startTime) } : null;
}

/** Where a stopped draft ended (the next day when the end time is before the start), else null. */
export function draftEndMoment(draft: DraftTimes): LocalMoment | null {
	if (!draft.startTime || !draft.endTime) return null;
	const endTime = fullTime(draft.endTime);
	const crossedMidnight = endTime < fullTime(draft.startTime);
	return { date: crossedMidnight ? nextDate(draft.date) : draft.date, time: endTime };
}

export type IntervalProblem = { code: 'boundary_outside' | 'interval_too_long' | 'invalid_start'; message: string };

/**
 * Null when `boundary` lies strictly inside the draft's interval: after its start and before its
 * end (stopped) or now (running, with the usual clock-skew slack). Both parts must be shorter than
 * a day, because durations are computed from times of day. Zero or negative parts are refused.
 */
export function splitBoundaryProblem(interval: {
	start: LocalMoment;
	end: LocalMoment | null;
	now: LocalMoment;
	boundary: LocalMoment;
}): IntervalProblem | null {
	const startSeconds = wallClockSeconds(interval.start);
	const boundarySeconds = wallClockSeconds(interval.boundary);
	if (boundarySeconds <= startSeconds) {
		return { code: 'boundary_outside', message: 'The split must come after the timer started.' };
	}
	if (interval.end) {
		if (boundarySeconds >= wallClockSeconds(interval.end)) {
			return { code: 'boundary_outside', message: 'The split must come before the timer stopped.' };
		}
	} else {
		const nowSeconds = wallClockSeconds(interval.now);
		if (boundarySeconds >= nowSeconds + FUTURE_TOLERANCE_SECONDS) {
			return { code: 'boundary_outside', message: 'The split must come before now.' };
		}
		if (nowSeconds - boundarySeconds >= MAXIMUM_TIMER_SECONDS) {
			return { code: 'interval_too_long', message: 'The remaining part would run for more than a day.' };
		}
	}
	if (boundarySeconds - startSeconds >= MAXIMUM_TIMER_SECONDS) {
		return { code: 'interval_too_long', message: 'The first part would be longer than a day.' };
	}
	return null;
}

/** Null when a stopped draft's start may move to `start`: before its end, less than a day before it. */
export function stoppedStartProblem(start: LocalMoment, end: LocalMoment): IntervalProblem | null {
	const lengthSeconds = wallClockSeconds(end) - wallClockSeconds(start);
	if (lengthSeconds <= 0) return { code: 'invalid_start', message: 'The start must be before the time the timer stopped.' };
	if (lengthSeconds >= MAXIMUM_TIMER_SECONDS) {
		return { code: 'interval_too_long', message: 'A timer can run for at most 24 hours; log longer work as an entry.' };
	}
	return null;
}
