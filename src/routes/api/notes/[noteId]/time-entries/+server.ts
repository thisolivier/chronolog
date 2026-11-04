import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getNoteForUser,
	getLinkedTimeEntriesForNote,
	linkTimeEntryToNote,
	unlinkTimeEntryFromNote
} from '$lib/server/db/queries/notes';
import { readJsonObject } from '$lib/server/api-request';
import { getTimeEntryForUser } from '$lib/server/db/queries/time-entries';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const { timeEntryId, headingAnchor } = body;
	if (!timeEntryId || typeof timeEntryId !== 'string') throw error(400, 'timeEntryId is required');
	if (headingAnchor !== undefined && headingAnchor !== null && typeof headingAnchor !== 'string') {
		throw error(400, 'headingAnchor must be text');
	}
	if (!UUID_PATTERN.test(timeEntryId) || !(await getTimeEntryForUser(timeEntryId, currentUser.id))) {
		throw error(404, 'Time entry not found');
	}

	const link = await linkTimeEntryToNote(noteId, timeEntryId, headingAnchor ?? undefined);
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

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const { timeEntryId } = body;
	if (!timeEntryId || typeof timeEntryId !== 'string') throw error(400, 'timeEntryId is required');

	await unlinkTimeEntryFromNote(noteId, timeEntryId);
	return json({ success: true });
};
