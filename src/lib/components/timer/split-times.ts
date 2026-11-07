/**
 * Split time: the two parts' times (design r1 SP-02, sprint 056-DR UI). Pure functions; the
 * reactive session is `split-session.svelte.ts`.
 *
 * The parts are adjacent intervals while linked: left = start..boundary, right = boundary..end,
 * where `end` is null while the right part is live (it runs through Now). Moments are local
 * wall-clock milliseconds (`new Date(y, m, d, h, mi, s)`), so a part can cross midnight.
 *
 * - Editing left To or right From moves the one shared boundary.
 * - A typed left duration moves the boundary from the start; a typed right duration moves it back
 *   from the end, or from Now at the moment the duration is confirmed (the caller passes `now`
 *   once, on blur or Enter): the boundary is then a fixed moment, so the live right part grows
 *   from it and nothing moves on later ticks.
 * - Outer start and (stopped) end stay editable.
 * - Zero or negative parts are refused inline (`splitTimesProblems`).
 */
import { parseDuration, MAX_DURATION_MINUTES } from '$lib/utils/duration';

export const MINUTE_MS = 60_000;

export type SplitTimes = {
	start: number;
	boundary: number;
	/** null: the right part is live and ends at Now */
	end: number | null;
};

export type SplitPartName = 'left' | 'right';

/** One part's content package (SP-03): Flip swaps these whole */
export type SplitContent = {
	contractId: string;
	deliverableId: string;
	workTypeId: string;
	/** Includes the `[[links]]` */
	description: string;
};

export function blankContent(): SplitContent {
	return { contractId: '', deliverableId: '', workTypeId: '', description: '' };
}

/** Flip (SP-03): the content packages change slots; times and chronology stay */
export function flipContent(left: SplitContent, right: SplitContent): { left: SplitContent; right: SplitContent } {
	return { left: { ...right }, right: { ...left } };
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` + `HH:MM[:SS]` (local) → milliseconds */
export function momentFromLocal(date: string, time: string): number {
	const [year, month, day] = date.split('-').map(Number);
	const [hours, minutes, seconds = 0] = time.split(':').map(Number);
	return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
}

export function localDateOf(moment: number): string {
	const date = new Date(moment);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `HH:MM:SS` */
export function localTimeOf(moment: number): string {
	const date = new Date(moment);
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** `HH:MM`, what a time input shows */
export function clockOf(moment: number): string {
	return localTimeOf(moment).slice(0, 5);
}

/** `YYYY-MM-DDTHH:MM:SS`, the API's local moment */
export function localMomentString(moment: number): string {
	return `${localDateOf(moment)}T${localTimeOf(moment)}`;
}

/** A typed `HH:MM` placed on the day (yesterday, same day, tomorrow) nearest to `reference` */
export function atClockNear(reference: number, clock: string): number | null {
	const match = clock.match(/^(\d{1,2}):(\d{2})/);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	const sameDay = new Date(reference);
	sameDay.setHours(hours, minutes, 0, 0);
	const candidates = [-1, 0, 1].map((offsetDays) => {
		const candidate = new Date(sameDay);
		candidate.setDate(candidate.getDate() + offsetDays);
		return candidate.getTime();
	});
	return candidates.reduce((best, candidate) =>
		Math.abs(candidate - reference) < Math.abs(best - reference) ? candidate : best
	);
}

function wholeSecond(moment: number): number {
	return Math.floor(moment / 1000) * 1000;
}

/** The right part's end: its frozen end, or Now while live */
export function endOrNow(times: SplitTimes, now: number): number {
	return times.end ?? now;
}

/** Whole minutes as the server counts them: seconds rounded up (0 for an empty or negative part) */
export function partMinutes(from: number, to: number): number {
	return to > from ? Math.ceil((to - from) / MINUTE_MS) : 0;
}

/**
 * The first boundary: halfway, on a whole clock minute, strictly inside when the capture allows.
 */
export function initialSplitTimes(start: number, end: number | null, now: number): SplitTimes {
	const finish = end ?? now;
	const halfway = start + (finish - start) / 2;
	let boundary = Math.floor(halfway / MINUTE_MS) * MINUTE_MS;
	if (boundary <= start || boundary >= finish) boundary = wholeSecond(halfway);
	return { start, boundary, end };
}

/** Left To / right From: one shared boundary */
export function withBoundary(times: SplitTimes, boundary: number): SplitTimes {
	return { ...times, boundary };
}

export function withStart(times: SplitTimes, start: number): SplitTimes {
	return { ...times, start };
}

export function withEnd(times: SplitTimes, end: number): SplitTimes {
	return { ...times, end };
}

/** A left duration moves the boundary from the start */
export function withLeftMinutes(times: SplitTimes, minutes: number): SplitTimes {
	return { ...times, boundary: times.start + minutes * MINUTE_MS };
}

/** A right duration moves the boundary back from the end, or from `now` (the confirmation instant) while live */
export function withRightMinutes(times: SplitTimes, minutes: number, now: number): SplitTimes {
	return { ...times, boundary: wholeSecond(endOrNow(times, now)) - minutes * MINUTE_MS };
}

export type DurationApplyResult = { ok: true; times: SplitTimes } | { ok: false; error: string };

/**
 * A duration (or range) typed into a part's duration field, confirmed now. The shared parser
 * (`duration.ts`) decides what is valid: 0 and empty are refused there. A range sets both ends
 * of that part; the live right part only takes a duration (it ends at Now).
 */
export function applyDurationText(times: SplitTimes, part: SplitPartName, text: string, now: number): DurationApplyResult {
	const parsed = parseDuration(text);
	if (!parsed.ok) return { ok: false, error: parsed.error };
	if (parsed.kind === 'duration') {
		return {
			ok: true,
			times: part === 'left' ? withLeftMinutes(times, parsed.durationMinutes) : withRightMinutes(times, parsed.durationMinutes, now)
		};
	}
	if (part === 'left') {
		const start = atClockNear(times.start, parsed.startTime);
		const boundary = start === null ? null : atClockNear(start + parsed.durationMinutes * MINUTE_MS, parsed.endTime);
		if (start === null || boundary === null) return { ok: false, error: 'Enter a time' };
		return { ok: true, times: { ...times, start, boundary } };
	}
	if (times.end === null) return { ok: false, error: 'Type a duration: this part runs until now' };
	const boundary = atClockNear(times.boundary, parsed.startTime);
	const end = boundary === null ? null : atClockNear(boundary + parsed.durationMinutes * MINUTE_MS, parsed.endTime);
	if (boundary === null || end === null) return { ok: false, error: 'Enter a time' };
	return { ok: true, times: { ...times, boundary, end } };
}

export type SplitTimesProblems = { left: string; right: string };

/** Inline problems per part; both empty means the split can be sent */
export function splitTimesProblems(times: SplitTimes, now: number): SplitTimesProblems {
	const finish = endOrNow(times, now);
	let left = '';
	let right = '';
	if (times.boundary <= times.start) left = 'This part must end after it starts';
	else if (times.boundary - times.start >= MAX_DURATION_MINUTES * MINUTE_MS) left = 'This part is 24 hours or longer';
	if (times.end === null && times.boundary >= now) right = 'This part cannot start in the future';
	else if (finish <= times.boundary) right = 'This part must end after it starts';
	else if (finish - times.boundary >= MAX_DURATION_MINUTES * MINUTE_MS) right = 'This part is 24 hours or longer';
	return { left, right };
}

/** True when `a` and `b` show the same clock minute (an untouched From keeps its seconds) */
export function sameMinute(a: number, b: number): boolean {
	return Math.floor(a / MINUTE_MS) === Math.floor(b / MINUTE_MS);
}
