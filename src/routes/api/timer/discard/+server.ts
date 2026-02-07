import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTimeEntry, getRunningTimer } from '$lib/server/db/queries/time-entries';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const entryId = body.entryId;

	if (!entryId) {
		throw error(400, 'entryId is required');
	}

	const deletedEntry = await deleteTimeEntry(entryId, currentUser.id);
	if (!deletedEntry) {
		throw error(404, 'Time entry not found');
	}

	return json({ success: true });
};
