import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchEverythingForUser, MINIMUM_QUERY_LENGTH } from '$lib/server/db/queries/global-search';
import { apiError } from '$lib/server/api-errors';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
/** Same ceiling as /api/notes/search */
const MAX_QUERY_LENGTH = 200;

/**
 * GET /api/search?q=&limit=  (sprint 042-CL)
 *
 * Searches the caller's notes (ID, title, body; not the trash) and time entries (description)
 * across every client. `{ query, notes: { hits, total }, timeEntries: { hits, total } }`; each hit
 * carries its client and contract, a date and a snippet with match offsets. `limit` is per group
 * (default 20, at most 50). A query under two characters returns empty groups.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const query = (url.searchParams.get('q') ?? '').trim();
	if (query.length > MAX_QUERY_LENGTH) {
		return apiError(400, `Search query must not exceed ${MAX_QUERY_LENGTH} characters`, 'query_too_long');
	}

	const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
	const limit = Number.isFinite(requestedLimit)
		? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
		: DEFAULT_LIMIT;

	const result = await searchEverythingForUser(currentUser.id, query, limit);
	return json({ ...result, minimumQueryLength: MINIMUM_QUERY_LENGTH });
};
