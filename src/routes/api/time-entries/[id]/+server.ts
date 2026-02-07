import { json } from '@sveltejs/kit';
import { deleteTimeEntry, updateTimeEntry } from '$lib/server/db/queries/time-entries';
import type { RequestHandler } from './$types';

/** PUT: Update a time entry (partial updates) */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;
	if (!id) {
		return json({ error: 'Missing entry ID' }, { status: 400 });
	}

	const body = await request.json();
	const updateData: Record<string, unknown> = {};

	if (body.contractId !== undefined) updateData.contractId = body.contractId;
	if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes;
	if (body.description !== undefined) updateData.description = body.description;

	if (Object.keys(updateData).length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	const updated = await updateTimeEntry(id, currentUser.id, updateData);

	if (!updated) {
		return json({ error: 'Entry not found or unauthorized' }, { status: 404 });
	}

	return json({ success: true, entry: updated });
};

/** DELETE: Remove a time entry */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;
	if (!id) {
		return json({ error: 'Missing entry ID' }, { status: 400 });
	}

	const deleted = await deleteTimeEntry(id, currentUser.id);

	if (!deleted) {
		return json({ error: 'Entry not found or unauthorized' }, { status: 404 });
	}

	return json({ success: true, deleted });
};
