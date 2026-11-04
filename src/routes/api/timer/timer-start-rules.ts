/**
 * Rules for choosing a running timer's start (sprint 041-CL), pure so they are easy to test.
 *
 * Times are the user's wall clock: a local `YYYY-MM-DD` date and `HH:MM[:SS]` time, compared as
 * if they were UTC (daylight-saving shifts are ignored; they only move the edges by an hour).
 * - A start in the future is refused (`start_in_future`), with a little slack for clock skew.
 * - A start more than 24 hours ago is refused (`start_too_early`): durations are computed from
 *   times of day, so a timer can never span more than a day.
 * - A start before the end of another entry overlapping the timer's run is allowed only once
 *   the user confirms (`start_overlaps_entry`, checked by the route with the entries).
 */

export type LocalMoment = { date: string; time: string };

/** A start up to this many seconds after "now" counts as now (browser vs server clock). */
export const FUTURE_TOLERANCE_SECONDS = 120;
export const MAXIMUM_TIMER_SECONDS = 24 * 60 * 60;

/** Seconds since 1970 for a wall-clock moment, read as UTC (only differences matter). */
export function wallClockSeconds(moment: LocalMoment): number {
	const [year, month, day] = moment.date.split('-').map(Number);
	const [hours = 0, minutes = 0, seconds = 0] = moment.time.split(':').map(Number);
	return Date.UTC(year, month - 1, day, hours, minutes, seconds) / 1000;
}

/** The wall clock (`YYYY-MM-DD`, `HH:MM:SS`) that `instant` shows in `timezone`. */
export function localMomentInTimezone(instant: Date, timezone: string): LocalMoment {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
			.formatToParts(instant)
			.map((part) => [part.type, part.value])
	);
	return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

export type TimerStartProblem = { code: 'start_in_future' | 'start_too_early'; message: string };

/** Future or more than a day ago: the start cannot be used whatever the user confirms. */
export function timerStartProblem(start: LocalMoment, now: LocalMoment): TimerStartProblem | null {
	const secondsBeforeNow = wallClockSeconds(now) - wallClockSeconds(start);
	if (secondsBeforeNow < -FUTURE_TOLERANCE_SECONDS) {
		return { code: 'start_in_future', message: 'The start time is in the future.' };
	}
	if (secondsBeforeNow > MAXIMUM_TIMER_SECONDS) {
		return { code: 'start_too_early', message: 'A timer can start at most 24 hours ago; log longer work as an entry.' };
	}
	return null;
}

export type TimedEntry = { id: string; date: string; startTime: string | null; endTime: string | null };

/**
 * The entry (with a start and end) that the timer's run, from `start` to `now`, would overlap:
 * it ends after the new start and begins before now. An end earlier than the entry's start
 * crossed midnight; an end equal to it has no length and is ignored. Of several, the one ending last is reported.
 */
export function findOverlappingEntry<Entry extends TimedEntry>(
	entries: Entry[],
	start: LocalMoment,
	now: LocalMoment
): Entry | null {
	const runStart = wallClockSeconds(start);
	const runEnd = Math.max(runStart, wallClockSeconds(now));
	let latestEnding: { entry: Entry; endSeconds: number } | null = null;
	for (const entry of entries) {
		if (!entry.startTime || !entry.endTime) continue;
		const entryStart = wallClockSeconds({ date: entry.date, time: entry.startTime });
		let entryEnd = wallClockSeconds({ date: entry.date, time: entry.endTime });
		if (entryEnd === entryStart) continue; // no length: nothing to overlap
		if (entryEnd < entryStart) entryEnd += 24 * 60 * 60;
		const overlaps = entryEnd > runStart && entryStart < runEnd;
		if (overlaps && (!latestEnding || entryEnd > latestEnding.endSeconds)) {
			latestEnding = { entry, endSeconds: entryEnd };
		}
	}
	return latestEnding?.entry ?? null;
}

/** `YYYY-MM-DD` one day before `date`. */
export function previousDate(date: string): string {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
