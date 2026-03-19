import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTimeEntry } from '$lib/server/db/queries/time-entries';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON in request body');
	}
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
