import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, sql } from 'drizzle-orm';
import { database, contracts, clients, notes } from '$lib/server/db';

/**
 * GET /api/contracts-by-client
 *
 * Returns a flat list of contracts with client name and note count.
 * Ordered by sortOrder then contract name.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractList = await database
		.select({
			id: contracts.id,
			name: contracts.name,
			isActive: contracts.isActive,
			sortOrder: contracts.sortOrder,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode,
			noteCount: sql<number>`cast(count(${notes.id}) as int)`
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.leftJoin(notes, eq(notes.contractId, contracts.id))
		.where(eq(clients.userId, currentUser.id))
		.groupBy(contracts.id, clients.id)
		.orderBy(contracts.sortOrder, contracts.name);

	return json({
		contracts: contractList.map((row) => ({
			id: row.id,
			name: row.name,
			isActive: row.isActive,
			sortOrder: row.sortOrder,
			clientId: row.clientId,
			clientName: row.clientName,
			clientShortCode: row.clientShortCode,
			noteCount: row.noteCount
		}))
	});
};
