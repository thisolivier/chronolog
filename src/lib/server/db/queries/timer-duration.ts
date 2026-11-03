/**
 * Pure duration maths for the timer.
 *
 * Times are `HH:MM:SS` (or `HH:MM`) strings as stored in `time_entries.start_time`
 * and `end_time`. Rules:
 * - the duration is computed from full seconds, then rounded UP to whole minutes,
 *   so a timer that ran at all is never saved as `0m` (minimum 1 minute);
 * - an end time earlier than the start time means the timer crossed midnight and
 *   is treated as the next day (24h added), so the result is never negative.
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

/** Parse `HH:MM:SS` or `HH:MM` into seconds since midnight. Missing parts count as 0. */
export function parseTimeToSeconds(timeString: string): number {
	const [hours = 0, minutes = 0, seconds = 0] = timeString.split(':').map(Number);
	return hours * 3600 + minutes * 60 + Math.floor(seconds);
}

/** Whole minutes between two times, rounded up, minimum 1, midnight-safe. */
export function calculateTimerDurationMinutes(startTime: string, endTime: string): number {
	let elapsedSeconds = parseTimeToSeconds(endTime) - parseTimeToSeconds(startTime);
	if (elapsedSeconds < 0) {
		elapsedSeconds += SECONDS_PER_DAY;
	}
	return Math.max(1, Math.ceil(elapsedSeconds / SECONDS_PER_MINUTE));
}
