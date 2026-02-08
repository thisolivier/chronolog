/**
 * POST /api/sync/push
 *
 * Accepts a batch of entity mutations from the client and applies them to the server.
 * Uses last-write-wins conflict resolution based on clientUpdatedAt vs server's updatedAt.
 *
 * Request body:
 * {
 *   changes: {
 *     clients: [{ operation: 'upsert', data: {...}, clientUpdatedAt: '...' }],
 *     timeEntries: [{ operation: 'delete', data: { id: '...' } }],
 *     ...
 *   }
 * }
 *
 * Returns: { applied, conflicts, serverTimestamp }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pushChanges } from '$lib/server/db/queries/sync';
import type { SyncPushRequest } from '$lib/sync/types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: SyncPushRequest;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.changes || typeof body.changes !== 'object') {
		return json({ error: 'Missing or invalid "changes" field' }, { status: 400 });
	}

	const pushResponse = await pushChanges(currentUser.id, body);

	return json(pushResponse);
};
