import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getNoteForUser,
	getNoteWithTimeEntriesForUser,
	linkTimeEntryToNote,
	unlinkTimeEntryFromNote
} from '$lib/server/db/queries/notes';

/**
 * GET /api/notes/[noteId]/time-entries
 *
 * Lists time entries linked to a note.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const { noteId } = params;
	const noteData = await getNoteWithTimeEntriesForUser(noteId, currentUser.id);
	if (!noteData) throw error(404, 'Note not found');

	return json({ timeEntries: noteData.linkedTimeEntries });
};

/**
 * POST /api/notes/[noteId]/time-entries
 *
 * Links a time entry to a note.
 * Body: { timeEntryId: string }
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const { noteId } = params;
	const note = await getNoteForUser(noteId, currentUser.id);
	if (!note) throw error(404, 'Note not found');

	const body = await request.json();
	const { timeEntryId } = body;
	if (!timeEntryId) throw error(400, 'timeEntryId is required');

	const link = await linkTimeEntryToNote(noteId, timeEntryId);
	return json({ link });
};

/**
 * DELETE /api/notes/[noteId]/time-entries
 *
 * Unlinks a time entry from a note.
 * Body: { timeEntryId: string }
 */
export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const { noteId } = params;
	const note = await getNoteForUser(noteId, currentUser.id);
	if (!note) throw error(404, 'Note not found');

	const body = await request.json();
	const { timeEntryId } = body;
	if (!timeEntryId) throw error(400, 'timeEntryId is required');

	await unlinkTimeEntryFromNote(noteId, timeEntryId);
	return json({ success: true });
};
