import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTrashedNotesForUser } from '$lib/server/db/queries/notes';

/**
 * GET /api/notes/trash  (sprint 037-CL)
 *
 * The caller's trashed notes, most recently deleted first:
 * `{ notes: [{ id, title, contractId, contract, deletedAt, purgeAt }] }` (`contract` is
 * `SHORTCODE/Contract name`; `purgeAt` is 30 days after `deletedAt`).
 */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');
	return json({ notes: await listTrashedNotesForUser(currentUser.id) });
};
