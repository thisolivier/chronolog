import { eq, and } from 'drizzle-orm';
import { database, contracts, clients } from '$lib/server/db';

export async function listContractsForClient(clientId: string) {
	return database
		.select()
		.from(contracts)
		.where(eq(contracts.clientId, clientId))
		.orderBy(contracts.name);
}

export async function getContractForClient(contractId: string, clientId: string) {
	const results = await database
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.clientId, clientId)))
		.limit(1);
	return results[0] ?? null;
}

export async function createContract(
	clientId: string,
	name: string,
	description: string | null,
	isActive: boolean
) {
	const results = await database
		.insert(contracts)
		.values({ clientId, name, description, isActive })
		.returning();
	return results[0];
}

export async function updateContract(
	contractId: string,
	clientId: string,
	data: { name?: string; description?: string | null; isActive?: boolean }
) {
	const results = await database
		.update(contracts)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(contracts.id, contractId), eq(contracts.clientId, clientId)))
		.returning();
	return results[0] ?? null;
}

export async function deleteContract(contractId: string, clientId: string) {
	const results = await database
		.delete(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.clientId, clientId)))
		.returning();
	return results[0] ?? null;
}

/** Verify that a client belongs to a user (used for authorization checks) */
export async function verifyClientOwnership(clientId: string, userId: string) {
	const results = await database
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.limit(1);
	return results.length > 0;
}
