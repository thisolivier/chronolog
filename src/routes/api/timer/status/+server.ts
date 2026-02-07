import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRunningTimer } from '$lib/server/db/queries/time-entries';

export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const runningTimer = await getRunningTimer(currentUser.id);
	return json({ timer: runningTimer });
};
