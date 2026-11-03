import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getNoteForUser,
	updateNoteForUser,
	deleteNoteForUser,
	NoteConflictError
} from '$lib/server/db/queries/notes';
import { updateNoteLinks } from '$lib/server/db/queries/note-links';

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
 * PUT /api/notes/[noteId]
 *
 * Updates a note's title and/or content.
 * Body: { title?, content?, contentJson?, contractId?, expectedUpdatedAt? }
 *
 * With `expectedUpdatedAt` (the `updatedAt` the client last saw) the save is refused with
 * 409 `{ error: 'conflict', updatedAt }` when the note changed since, e.g. in another tab.
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { title, content, contentJson, contractId, expectedUpdatedAt } = body;

	let expectedDate: Date | undefined;
	if (expectedUpdatedAt !== undefined) {
		expectedDate = new Date(expectedUpdatedAt);
		if (Number.isNaN(expectedDate.getTime())) throw error(400, 'Invalid expectedUpdatedAt');
	}

	let note;
	try {
		note = await updateNoteForUser(
			currentUser.id,
			params.noteId,
			title,
			content,
			contentJson,
			contractId,
			expectedDate
		);
	} catch (updateError) {
		if (updateError instanceof NoteConflictError) {
			return json(
				{ error: 'conflict', updatedAt: updateError.currentUpdatedAt.toISOString() },
				{ status: 409 }
			);
		}
		throw updateError;
	}

	if (!note) {
		throw error(404, 'Note not found');
	}

	// Update backlinks index from wiki-links in content (also when emptied, to drop old links)
	if (typeof content === 'string') {
		await updateNoteLinks(params.noteId, content);
	}

	return json({ note });
};

/**
 * DELETE /api/notes/[noteId]
 *
 * Deletes a note.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const deletedNote = await deleteNoteForUser(currentUser.id, params.noteId);

	if (!deletedNote) {
		throw error(404, 'Note not found');
	}

	return json({ success: true });
};
