import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reorderClientsForUser } from '$lib/server/db/queries/client-order';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';
import { isUuid } from '$lib/utils/uuid';
import { unauthorized } from '../../admin-input';

/**
 * PATCH /api/clients/reorder — body `{ orderedIds: string[] }` (sprint 039-CL, the sidebar's
 * drag and Alt+Arrow moves). The listed clients take positions 0..n-1 in that order; the user's
 * other clients (archived ones, when the sidebar sends its active list) follow in their current
 * order. Every ID must be one of the user's clients, listed once, else 400 and nothing changes.
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return unauthorized();

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const orderedIds = parsedBody.body.orderedIds;
	if (!Array.isArray(orderedIds) || !orderedIds.every(isUuid)) {
		return apiError(400, 'orderedIds must be an array of client IDs', 'invalid_input');
	}

	const saved = await reorderClientsForUser(locals.user.id, orderedIds);
	if (!saved) return apiError(400, 'Every ID must be one of your clients, listed once', 'invalid_input');
	return json({ ok: true });
};
