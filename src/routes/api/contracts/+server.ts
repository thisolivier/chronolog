import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { database, contracts, clients } from '$lib/server/db';

/** GET /api/contracts — list contracts for the current user, with client info */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractList = await database
		.select({
			id: contracts.id,
			name: contracts.name,
			isActive: contracts.isActive,
			clientId: contracts.clientId,
			clientName: clients.name,
			clientShortCode: clients.shortCode
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(eq(clients.userId, currentUser.id))
		.orderBy(clients.name, contracts.name);

	return json(contractList);
};
