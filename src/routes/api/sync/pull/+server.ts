/**
 * GET /api/sync/pull?since=2026-01-01T00:00:00.000Z
 *
 * Pulls all entities changed since the given timestamp for the authenticated user.
 * If `since` is omitted, performs a full sync (returns all data).
 *
 * Returns JSON with entities grouped by table + serverTimestamp.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pullChangesSince } from '$lib/server/db/queries/sync';

export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const sinceParam = url.searchParams.get('since');
	let sinceDate: Date | null = null;

	if (sinceParam) {
		sinceDate = new Date(sinceParam);
		if (isNaN(sinceDate.getTime())) {
			return json({ error: 'Invalid "since" parameter — must be an ISO timestamp' }, { status: 400 });
		}
	}

	const pullResponse = await pullChangesSince(currentUser.id, sinceDate);

	return json(pullResponse);
};
