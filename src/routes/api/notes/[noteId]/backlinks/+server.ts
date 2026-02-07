import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBacklinksForNote } from '$lib/server/db/queries/note-links';

export const GET: RequestHandler = async ({ locals, params }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const { noteId } = params;
	const backlinks = await getBacklinksForNote(noteId);
	return json({ backlinks });
};
