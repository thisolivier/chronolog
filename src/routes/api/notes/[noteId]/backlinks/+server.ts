import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBacklinksForNote } from '$lib/server/db/queries/note-links';

/**
 * GET /api/notes/[noteId]/backlinks
 *
 * The caller's notes that link to this one; notes in the trash are left out (sprint 037-CL).
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const { noteId } = params;
	const backlinks = await getBacklinksForNote(noteId, currentUser.id);
	return json({ backlinks });
};
