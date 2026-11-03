import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reorderContractsForUser } from '$lib/server/db/queries/contracts';
import { isUuid } from '$lib/utils/uuid';

/**
 * PATCH /api/contracts/reorder — body `{ orderedIds: string[] }` (BACKLOG Task 13).
 * `orderedIds[index]` gets `sortOrder = index`. Every ID must be one of the user's contracts;
 * otherwise nothing changes and the response is 400.
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	const orderedIds = (body as { orderedIds?: unknown } | null)?.orderedIds;
	if (!Array.isArray(orderedIds) || !orderedIds.every(isUuid)) {
		return json({ error: 'orderedIds must be an array of contract IDs' }, { status: 400 });
	}

	const saved = await reorderContractsForUser(locals.user.id, orderedIds);
	if (!saved) {
		return json({ error: 'Every ID must be one of your contracts, listed once' }, { status: 400 });
	}
	return json({ ok: true });
};
