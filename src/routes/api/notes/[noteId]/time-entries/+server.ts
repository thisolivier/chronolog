import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getNoteForUser,
	getLinkedTimeEntriesForNote,
	linkTimeEntryToNote,
	unlinkTimeEntryFromNote
} from '$lib/server/db/queries/notes';

/**
 * GET /api/notes/[noteId]/time-entries
 *
 * Lists time entries linked to a note with full display data
 * (date, description, duration, contract/client names).
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const { noteId } = params;
	const note = await getNoteForUser(noteId, currentUser.id);
	if (!note) throw error(404, 'Note not found');

	const timeEntries = await getLinkedTimeEntriesForNote(noteId, currentUser.id);
	return json({ timeEntries });
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
	const { timeEntryId, headingAnchor } = body;
	if (!timeEntryId) throw error(400, 'timeEntryId is required');

	const link = await linkTimeEntryToNote(noteId, timeEntryId, headingAnchor);
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
