import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startTimer, getRunningTimer } from '$lib/server/db/queries/time-entries';
import { readLocalDate, readLocalTime } from '../local-clock';
import { readJsonObject } from '$lib/server/api-request';
import { entryReferenceProblem } from '../../time-entries/entry-input';
import { checkTimerStart } from '../start-guard';

/**
 * POST /api/timer/start — `{ contractId, date?, startTime?, confirmed? }`. Unless `confirmed`, a
 * given start is checked like `PATCH /api/timer` (sprint 041-CL): 400 `start_in_future`,
 * 400 `start_too_early`, 409 `start_overlaps_entry`. The browser sends `confirmed` because its
 * start is "now" or a timer the user already started in the page; the CLI sends it for "now"
 * and after the person confirmed an overlap.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Check if there's already a running timer
	const existingTimer = await getRunningTimer(currentUser.id);
	if (existingTimer) {
		throw error(409, 'A timer is already running. Stop it before starting a new one.');
	}

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const contractId = body.contractId;

	if (!contractId || typeof contractId !== 'string') {
		throw error(400, 'contractId is required to start a timer');
	}
	const referenceProblem = await entryReferenceProblem({ userId: currentUser.id, contractId });
	if (referenceProblem) return referenceProblem;

	const localStart = { date: readLocalDate(body.date), startTime: readLocalTime(body.startTime) };
	// `confirmed` (the browser, or the CLI after a yes) is trusted as is: a browser clock a little
	// ahead of the server's must never stop a timer from starting
	if (localStart.date && localStart.startTime && body.confirmed !== true) {
		const refusal = await checkTimerStart({
			userId: currentUser.id,
			url,
			request,
			start: { date: localStart.date, time: localStart.startTime },
			confirmed: false
		});
		if (refusal) return refusal;
	}

	const timerEntry = await startTimer(currentUser.id, contractId, localStart);
	return json(timerEntry, { status: 201 });
};
