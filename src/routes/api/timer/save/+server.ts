import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateTimeEntry } from '$lib/server/db/queries/time-entries';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { entryId, contractId, deliverableId, workTypeId, description } = body;

	if (!entryId) {
		throw error(400, 'entryId is required');
	}
	if (!contractId) {
		throw error(400, 'contractId is required to save a time entry');
	}

	const savedEntry = await updateTimeEntry(entryId, currentUser.id, {
		contractId,
		deliverableId: deliverableId || null,
		workTypeId: workTypeId || null,
		description: description || null,
		isDraft: false
	});

	if (!savedEntry) {
		throw error(404, 'Time entry not found');
	}

	return json(savedEntry);
};
