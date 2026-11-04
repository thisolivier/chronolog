import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteForUser, restoreNoteForUser } from '$lib/server/db/queries/notes';
import { apiError } from '$lib/server/api-errors';

/**
 * POST /api/notes/[noteId]/restore  (sprint 037-CL)
 *
 * Takes the caller's note out of the trash with its ID, links and time-entry links as they were.
 * 404 `not_in_trash` when the note is not the caller's or is not in the trash. A restore onto an
 * archived contract is allowed; `contract.archived` says so. Returns `{ note, contract }`.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const restored = await restoreNoteForUser(currentUser.id, params.noteId);
	if (!restored) return apiError(404, `Note ${params.noteId} is not in your trash`, 'not_in_trash');

	const note = await getNoteForUser(restored.id, currentUser.id);
	return json({ note, contract: restored.contract });
};
