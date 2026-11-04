import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchNotesForUser } from '$lib/server/db/queries/notes';
import { apiError } from '$lib/server/api-errors';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
/** Longest query accepted (from `fix/time-entry-search-input-validation`, sprint 029-CL). */
const MAX_QUERY_LENGTH = 200;

/**
 * GET /api/notes/search?q=&exclude=&limit=&recent=1
 *
 * Ranked search across all of the user's notes (exact ID, ID prefix, title, body).
 * `exclude` drops one note (the note being edited). An empty `q` returns nothing,
 * unless `recent=1`, which returns the most recently edited notes.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const query = (url.searchParams.get('q') ?? '').trim();
	const wantsRecent = url.searchParams.get('recent') === '1';
	if (!query && !wantsRecent) {
		return json({ notes: [] });
	}
	if (query.length > MAX_QUERY_LENGTH) {
		return apiError(400, `Search query must not exceed ${MAX_QUERY_LENGTH} characters`, 'query_too_long');
	}

	const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
	const limit = Number.isFinite(requestedLimit)
		? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
		: DEFAULT_LIMIT;

	const results = await searchNotesForUser(currentUser.id, query, {
		limit,
		excludeNoteId: url.searchParams.get('exclude') ?? undefined
	});
	return json({ notes: results });
};
