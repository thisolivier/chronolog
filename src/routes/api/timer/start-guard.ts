/**
 * Shared check for a chosen timer start (sprint 041-CL), used by `POST /api/timer/start` and
 * `PATCH /api/timer`. "Now" is the caller's wall clock: the server's clock read in the caller's
 * timezone (`X-Timezone` / `?tz=`, sent by the browser and the CLI).
 */
import { apiError } from '$lib/server/api-errors';
import { readRequestTimezone } from '$lib/server/api-request';
import { getTimeEntryForUser } from '$lib/server/db/queries/time-entries';
import { listTimedEntriesBetween } from '$lib/server/db/queries/timer-start';
import {
	findOverlappingEntry,
	localMomentInTimezone,
	previousDate,
	timerStartProblem,
	type LocalMoment
} from './timer-start-rules';

export type TimerStartCheck = {
	userId: string;
	url: URL;
	request: Request;
	start: LocalMoment;
	/** The user already confirmed an overlap (UI "Save anyway", CLI `--yes`) */
	confirmed: boolean;
};

const shortTime = (time: string | null) => (time ? time.slice(0, 5) : '--:--');

/** Null when the start is fine, else the error response to return. */
export async function checkTimerStart(check: TimerStartCheck): Promise<Response | null> {
	const timezoneResult = readRequestTimezone(check.url, check.request);
	if (!timezoneResult.ok) return timezoneResult.response;
	const now = localMomentInTimezone(new Date(), timezoneResult.timezone);

	const problem = timerStartProblem(check.start, now);
	if (problem) return apiError(400, problem.message, problem.code);
	if (check.confirmed) return null;

	const candidates = await listTimedEntriesBetween(check.userId, previousDate(check.start.date), now.date);
	const overlapping = findOverlappingEntry(candidates, check.start, now);
	if (!overlapping) return null;

	const details = await getTimeEntryForUser(overlapping.id, check.userId);
	const label = details ? `${details.clientName} / ${details.contractName}` : 'another entry';
	const range = `${shortTime(overlapping.startTime)}–${shortTime(overlapping.endTime)}`;
	return apiError(
		409,
		`This start is before the end of ${label} ${range} on ${overlapping.date}. Confirm to keep it.`,
		'start_overlaps_entry',
		{
			overlappingEntry: {
				id: overlapping.id,
				date: overlapping.date,
				startTime: overlapping.startTime,
				endTime: overlapping.endTime,
				clientName: details?.clientName ?? null,
				contractName: details?.contractName ?? null
			}
		}
	);
}
