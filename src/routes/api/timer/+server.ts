import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { getRunningTimer } from '$lib/server/db/queries/time-entries';
import { moveRunningTimerStart } from '$lib/server/db/queries/timer-start';
import { isCalendarDate } from '$lib/utils/local-calendar';
import { readLocalTime } from './local-clock';
import { checkTimerStart } from './start-guard';

/**
 * PATCH /api/timer — move the running timer's start (sprint 041-CL).
 * Body: `{ startTime: "HH:MM[:SS]", date?: "YYYY-MM-DD" (default: the timer's date), confirmed?: true }`.
 * 400 `invalid_start` · 400 `start_in_future` · 400 `start_too_early` (over 24 hours ago) ·
 * 404 `no_running_timer` · 409 `timer_stopped` (stopped, waiting to be saved) ·
 * 409 `start_overlaps_entry` with `overlappingEntry` unless `confirmed` is true.
 * Returns the timer entry, like `GET /api/timer/status`'s `timer`.
 */
export const PATCH: RequestHandler = async ({ locals, request, url }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;

	const startTime = readLocalTime(body.startTime);
	if (!startTime) return apiError(400, 'startTime must be HH:MM or HH:MM:SS', 'invalid_start');
	if (body.date !== undefined && (typeof body.date !== 'string' || !isCalendarDate(body.date))) {
		return apiError(400, 'date must be YYYY-MM-DD', 'invalid_start');
	}

	const runningTimer = await getRunningTimer(currentUser.id);
	if (!runningTimer) return apiError(404, 'No running timer', 'no_running_timer');
	if (runningTimer.endTime) {
		return apiError(409, 'The timer is stopped: change the time in the completion form instead', 'timer_stopped');
	}

	const start = { date: (body.date as string | undefined) ?? runningTimer.date, time: startTime };
	const refusal = await checkTimerStart({
		userId: currentUser.id,
		url,
		request,
		start,
		confirmed: body.confirmed === true
	});
	if (refusal) return refusal;

	const movedTimer = await moveRunningTimerStart(runningTimer.id, currentUser.id, {
		date: start.date,
		startTime: start.time.length === 5 ? `${start.time}:00` : start.time
	});
	if (!movedTimer) return apiError(404, 'No running timer', 'no_running_timer');
	return json(await getRunningTimer(currentUser.id));
};
