import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteForUser, deleteNoteForUser } from '$lib/server/db/queries/notes';
import { trashPurgeDate } from '$lib/server/db/queries/note-trash';
import { applyNoteChanges } from './note-changes';
import { apiError } from '$lib/server/api-errors';

/**
 * GET /api/notes/[noteId]
 *
 * Returns the full note including content; 404 `note_in_trash` for the caller's note in the trash.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const note = await getNoteForUser(params.noteId, currentUser.id);

	if (!note) {
		// The owner's note in the trash gets its own code, so the CLI can point at the restore
		if (await getNoteForUser(params.noteId, currentUser.id, { includeDeleted: true })) {
			return apiError(404, `Note ${params.noteId} is in the trash`, 'note_in_trash');
		}
		throw error(404, 'Note not found');
	}

	return json({ note });
};

/**
 * PUT /api/notes/[noteId]  (the browser's autosave and move)
 *
 * Body: { title?, content?, contentJson?, contractId?, expectedUpdatedAt? }
 *
 * The browser sends `content` and `contentJson` together. `content` alone clears `contentJson`
 * (sprint 034-CL) so the editor reloads from the new markdown. With `expectedUpdatedAt` (the
 * `updatedAt` the client last saw) the save is refused with 409 `{ error: 'conflict', updatedAt }`
 * when the note changed since, e.g. in another tab. A `contractId` must be the caller's (403
 * `contract_forbidden`).
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');
	return applyNoteChanges(request, currentUser.id, params.noteId, { requireExpectedUpdatedAt: false });
};

/**
 * PATCH /api/notes/[noteId]  (partial changes from the CLI, sprint 034-CL)
 *
 * Same fields and rules as PUT, but `expectedUpdatedAt` is required (400 without it), so a change
 * is always based on the copy the caller read.
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');
	return applyNoteChanges(request, currentUser.id, params.noteId, { requireExpectedUpdatedAt: true });
};

/**
 * DELETE /api/notes/[noteId]
 *
 * Moves the note to the trash (sprint 037-CL): it keeps its ID, links and time-entry links and can be
 * restored with `POST /api/notes/[noteId]/restore` for 30 days. The same call purges the caller's
 * notes trashed longer ago. Returns `{ success, id, title, contractId, deletedAt, purgeAt }`; 404 for
 * a note that is not the caller's or is already in the trash.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const deletedNote = await deleteNoteForUser(currentUser.id, params.noteId);

	if (!deletedNote) {
		throw error(404, 'Note not found');
	}

	return json({
		success: true,
		id: deletedNote.id,
		title: deletedNote.title,
		contractId: deletedNote.contractId,
		deletedAt: deletedNote.deletedAt,
		purgeAt: trashPurgeDate(deletedNote.deletedAt)
	});
};
