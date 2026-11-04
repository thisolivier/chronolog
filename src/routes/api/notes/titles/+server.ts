import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNoteTitlesForUser } from '$lib/server/db/queries/notes';

const MAX_IDS = 100;

/**
 * GET /api/notes/titles?ids=A,B,C[&includeDeleted=1]
 *
 * Display titles for wiki-link rendering: `{ titles: [{ id, displayTitle, contractId, clientId }] }`.
 * IDs the user does not own are omitted, and so are notes in the trash unless `includeDeleted=1`,
 * which adds `deletedAt` (null for a live note) to every entry (sprint 037-CL).
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const noteIds = (url.searchParams.get('ids') ?? '')
		.split(',')
		.map((noteId) => noteId.trim())
		.filter(Boolean)
		.slice(0, MAX_IDS);

	const includeDeleted = url.searchParams.get('includeDeleted') === '1';
	const titles = await getNoteTitlesForUser(currentUser.id, [...new Set(noteIds)], { includeDeleted });
	return json({ titles });
};
