import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchNotesForUser } from '$lib/server/db/queries/notes';

export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const query = url.searchParams.get('q');
	if (!query || query.length < 1) {
		return json({ notes: [] });
	}
	if (query.length > 200) {
		throw error(400, 'Search query must not exceed 200 characters');
	}

	const results = await searchNotesForUser(currentUser.id, query);
	return json({ notes: results });
};
