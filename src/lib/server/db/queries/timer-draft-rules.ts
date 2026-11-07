/**
 * Pure rules for the draft timer's optimistic checks (sprint 056-DR review fixes), shared by the
 * locked save/discard/split queries and `PATCH /api/timer`. No database access here.
 */

/** A split's advanced draft carries `<clientRequestId>:remainder` in `client_request_id`. */
export const REMAINDER_MARK_SUFFIX = ':remainder';

/** A moment as the client sent it: `HH:MM` (minute precision) or `HH:MM:SS`. */
export type ExpectedMoment = { date: string; time: string };

const fullTime = (time: string) => (time.length === 5 ? `${time}:00` : time);

/**
 * Whether a stored date + time (`HH:MM:SS`) is the moment the client expects, compared at the
 * precision it sent: a timer started at 09:00:37 matches "09:00" and "09:00:37", not "09:00:00".
 */
export function momentMatches(stored: { date: string; time: string | null }, expected: ExpectedMoment): boolean {
	if (!stored.time || stored.date !== expected.date) return false;
	const storedTime = fullTime(stored.time);
	return expected.time.length === 5 ? storedTime.slice(0, 5) === expected.time : storedTime === expected.time;
}

/** The draft is the remainder of a split, so a device that has not seen the split could be stale. */
export function isSplitRemainder(row: { clientRequestId: string | null }): boolean {
	return row.clientRequestId?.endsWith(REMAINDER_MARK_SUFFIX) ?? false;
}
