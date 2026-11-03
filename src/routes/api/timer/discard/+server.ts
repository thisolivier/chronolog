import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteTimeEntry } from '$lib/server/db/queries/time-entries';
import { readJsonObject } from '$lib/server/api-request';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const entryId = body.entryId;

	if (!entryId || typeof entryId !== 'string') {
		throw error(400, 'entryId is required');
	}

	const deletedEntry = await deleteTimeEntry(entryId, currentUser.id);
	if (!deletedEntry) {
		throw error(404, 'Time entry not found');
	}

	return json({ success: true });
};
