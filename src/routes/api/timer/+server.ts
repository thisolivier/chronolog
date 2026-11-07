import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { getRunningTimer } from '$lib/server/db/queries/time-entries';
import { moveRunningTimerStart, moveStoppedTimerStart, resumeStoppedTimer } from '$lib/server/db/queries/timer-start';
import { calculateTimerDurationMinutes } from '$lib/server/db/queries/timer-duration';
import { isCalendarDate } from '$lib/utils/local-calendar';
import { readLocalTime } from './local-clock';
import { checkTimerStart } from './start-guard';
import { readExpectedStart } from './expected-start';
import { draftEndMoment, draftStartMoment, fullTime, sameMoment, stoppedStartProblem } from './timer-moments';

/**
 * PATCH /api/timer — move the draft timer's start (sprint 041-CL), or resume a stopped one
 * (sprint 056-DR). Body: `{ startTime?: "HH:MM[:SS]", date?: "YYYY-MM-DD" (default: the timer's
 * date), confirmed?: true, resume?: true, expectedStartedAt?: "YYYY-MM-DDTHH:MM[:SS]" }`.
 * - Running: `startTime` is required; the start moves (400 `start_in_future` / `start_too_early`).
 * - Stopped, no `resume`: `startTime` is required; the start moves and the end stays, the
 *   duration is re-measured (400 `invalid_start` at or after the end, 400 `interval_too_long`).
 * - Stopped, `resume: true`: the end is cleared and the timer runs again from its start (or from
 *   `startTime`/`date` when given) through now, editing time included. 409 `timer_running` when it
 *   is not stopped.
 * Also 400 `invalid_start`, 404 `no_running_timer`, 409 `timer_changed` when `expectedStartedAt`
 * is not the draft's start, and 409 `start_overlaps_entry` with `overlappingEntry` unless
 * `confirmed`. Returns the timer entry, like `GET /api/timer/status`'s `timer`.
 */
export const PATCH: RequestHandler = async ({ locals, request, url }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const resume = body.resume === true;

	const startTime = readLocalTime(body.startTime);
	if (!startTime && !(resume && body.startTime === undefined)) {
		return apiError(400, 'startTime must be HH:MM or HH:MM:SS', 'invalid_start');
	}
	if (body.date !== undefined && (typeof body.date !== 'string' || !isCalendarDate(body.date))) {
		return apiError(400, 'date must be YYYY-MM-DD', 'invalid_start');
	}
	const expectedStart = readExpectedStart(body.expectedStartedAt);
	if (expectedStart instanceof Response) return expectedStart;

	const timer = await getRunningTimer(currentUser.id);
	if (!timer) return apiError(404, 'No running timer', 'no_running_timer');
	const currentStart = draftStartMoment(timer);
	if (expectedStart && (!currentStart || !sameMoment(currentStart, expectedStart))) {
		return apiError(409, 'The timer changed since this screen loaded; reload it and try again', 'timer_changed');
	}

	const start = {
		date: (body.date as string | undefined) ?? timer.date,
		time: fullTime(startTime ?? timer.startTime ?? '00:00:00')
	};
	const confirmed = body.confirmed === true;
	const timerEnd = draftEndMoment(timer);

	if (!timer.endTime) {
		if (resume) return apiError(409, 'The timer is already running', 'timer_running');
		const refusal = await checkTimerStart({ userId: currentUser.id, url, request, start, confirmed });
		if (refusal) return refusal;
		const moved = await moveRunningTimerStart(timer.id, currentUser.id, { date: start.date, startTime: start.time });
		if (!moved) return apiError(404, 'No running timer', 'no_running_timer');
	} else if (resume) {
		const refusal = await checkTimerStart({ userId: currentUser.id, url, request, start, confirmed });
		if (refusal) return refusal;
		const resumed = await resumeStoppedTimer(timer.id, currentUser.id, { date: start.date, startTime: start.time });
		if (!resumed) return apiError(404, 'No running timer', 'no_running_timer');
	} else if (timerEnd) {
		const problem = stoppedStartProblem(start, timerEnd);
		if (problem) return apiError(400, problem.message, problem.code);
		const refusal = await checkTimerStart({ userId: currentUser.id, url, request, start, confirmed, runEnd: timerEnd });
		if (refusal) return refusal;
		const moved = await moveStoppedTimerStart(timer.id, currentUser.id, {
			date: start.date,
			startTime: start.time,
			durationMinutes: calculateTimerDurationMinutes(start.time, timerEnd.time)
		});
		if (!moved) return apiError(404, 'No running timer', 'no_running_timer');
	}
	return json(await getRunningTimer(currentUser.id));
};
