import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteForUser, deleteNoteForUser } from '$lib/server/db/queries/notes';
import { applyNoteChanges } from './note-changes';

/**
 * GET /api/notes/[noteId]
 *
 * Returns the full note including content.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const note = await getNoteForUser(params.noteId, currentUser.id);

	if (!note) {
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
 * Hard-deletes a note and its time-entry links. Returns `{ success, id, title, contractId }` of the
 * deleted note.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const deletedNote = await deleteNoteForUser(currentUser.id, params.noteId);

	if (!deletedNote) {
		throw error(404, 'Note not found');
	}

	return json({ success: true, id: deletedNote.id, title: deletedNote.title, contractId: deletedNote.contractId });
};
