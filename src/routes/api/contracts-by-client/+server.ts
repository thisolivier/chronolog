import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { database, contracts, clients } from '$lib/server/db';

/**
 * GET /api/contracts-by-client
 *
 * Returns contracts grouped by client for the current user.
 * Used by the ContractsSidebar to build the hierarchical navigation.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Fetch all contracts with their client info for this user
	const contractList = await database
		.select({
			contractId: contracts.id,
			contractName: contracts.name,
			contractIsActive: contracts.isActive,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(eq(clients.userId, currentUser.id))
		.orderBy(clients.name, contracts.name);

	// Group contracts by client
	const clientsMap = new Map<
		string,
		{
			id: string;
			name: string;
			shortCode: string;
			contracts: Array<{ id: string; name: string; isActive: boolean }>;
		}
	>();

	for (const row of contractList) {
		if (!clientsMap.has(row.clientId)) {
			clientsMap.set(row.clientId, {
				id: row.clientId,
				name: row.clientName,
				shortCode: row.clientShortCode,
				contracts: []
			});
		}

		const client = clientsMap.get(row.clientId)!;
		client.contracts.push({
			id: row.contractId,
			name: row.contractName,
			isActive: row.contractIsActive
		});
	}

	const clientsArray = Array.from(clientsMap.values());

	return json({ clients: clientsArray });
};
