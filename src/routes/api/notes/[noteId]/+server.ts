import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteForUser, updateNoteForUser, deleteNoteForUser } from '$lib/server/db/queries/notes';
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
 * Body: { title?, content?, contentJson? }
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { title, content, contentJson } = body;

	const note = await updateNoteForUser(
		currentUser.id,
		params.noteId,
		title,
		content,
		contentJson
	);

	if (!note) {
		throw error(404, 'Note not found');
	}

	// Update backlinks index from wiki-links in content
	if (content) {
		await updateNoteLinks(params.noteId, content, currentUser.id);
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
