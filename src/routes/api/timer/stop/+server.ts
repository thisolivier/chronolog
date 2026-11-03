import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stopTimer, getRunningTimer } from '$lib/server/db/queries/time-entries';
import { readLocalTime } from '../local-clock';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const runningTimer = await getRunningTimer(currentUser.id);
	if (!runningTimer) {
		throw error(404, 'No running timer found');
	}

	const body = await request.json().catch(() => ({}));
	const stoppedEntry = await stopTimer(runningTimer.id, currentUser.id, readLocalTime(body?.endTime));
	if (!stoppedEntry) {
		throw error(500, 'Failed to stop timer');
	}

	return json(stoppedEntry);
};
