import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchNotesForUser } from '$lib/server/db/queries/notes';
import { DEFAULT_NOTE_SEARCH_LIMIT } from '$lib/server/db/queries/note-search';
import { apiError } from '$lib/server/api-errors';

const MAX_LIMIT = 50;
/** Longest query accepted (from `fix/time-entry-search-input-validation`, sprint 029-CL). */
const MAX_QUERY_LENGTH = 200;

/**
 * GET /api/notes/search?q=&exclude=&limit=&recent=1
 *
 * The `[[` wiki-link picker's search across all of the user's notes, never scoped to a client or
 * contract. Same shared matcher and rank order as `GET /api/search` (sprint 058-DR): every word in
 * the note's ID, title, body, client name, client short code or contract name; ranked exact ID,
 * ID prefix, title, ID substring, body, content plus client/contract, client/contract only; newest
 * first within a rank. Each result adds `rank`, `matchedIn`, `matchedContext`, `titleMatches`,
 * `snippet` and `clientColorIndex` to the earlier fields. `limit` defaults to 8 (at most 50).
 * `exclude` drops one note (the note being edited). An empty `q` returns nothing, unless
 * `recent=1`, which returns the most recently edited notes across every contract.
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
		: DEFAULT_NOTE_SEARCH_LIMIT;

	const results = await searchNotesForUser(currentUser.id, query, {
		limit,
		excludeNoteId: url.searchParams.get('exclude') ?? undefined
	});
	return json({ notes: results });
};
