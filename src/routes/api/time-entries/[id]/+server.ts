import { json } from '@sveltejs/kit';
import { deleteTimeEntry } from '$lib/server/db/queries/time-entries';
import type { RequestHandler } from './$types';

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
