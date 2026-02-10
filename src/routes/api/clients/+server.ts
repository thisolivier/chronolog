import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listClientsForUser } from '$lib/server/db/queries/clients';

/**
 * GET /api/clients
 *
 * Returns all clients for the current user, ordered by name.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const clientList = await listClientsForUser(currentUser.id);

	return json({
		clients: clientList.map((client) => ({
			id: client.id,
			name: client.name,
			shortCode: client.shortCode
		}))
	});
};
