import { eq, and } from 'drizzle-orm';
import { database, deliverables, contracts, clients } from '$lib/server/db';

/**
 * One of the user's deliverables, found through its contract and client (never the system
 * contract's). `parentArchived` is true when the contract or its client is archived: deliverables
 * have no archive state of their own, so they count as archived with their parent. `null` when
 * missing or someone else's, so API routes answer 404 either way.
 */
export async function getDeliverableForUser(deliverableId: string, userId: string) {
	const results = await database
		.select({
			deliverable: deliverables,
			contractArchivedAt: contracts.archivedAt,
			clientArchivedAt: clients.archivedAt
		})
		.from(deliverables)
		.innerJoin(contracts, eq(deliverables.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(
			and(eq(deliverables.id, deliverableId), eq(clients.userId, userId), eq(contracts.isSystem, false))
		)
		.limit(1);
	const row = results[0];
	if (!row) return null;
	return { ...row.deliverable, parentArchived: Boolean(row.contractArchivedAt || row.clientArchivedAt) };
}

export async function listDeliverablesForContract(contractId: string) {
	return database
		.select()
		.from(deliverables)
		.where(eq(deliverables.contractId, contractId))
		.orderBy(deliverables.sortOrder);
}

export async function getDeliverable(deliverableId: string, contractId: string) {
	const results = await database
		.select()
		.from(deliverables)
		.where(and(eq(deliverables.id, deliverableId), eq(deliverables.contractId, contractId)))
		.limit(1);
	return results[0] ?? null;
}

export async function createDeliverable(
	contractId: string,
	name: string,
	sortOrder: number
) {
	const results = await database
		.insert(deliverables)
		.values({ contractId, name, sortOrder })
		.returning();
	return results[0];
}

export async function updateDeliverable(
	deliverableId: string,
	contractId: string,
	data: { name?: string; sortOrder?: number }
) {
	const results = await database
		.update(deliverables)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(deliverables.id, deliverableId), eq(deliverables.contractId, contractId)))
		.returning();
	return results[0] ?? null;
}

// Deliverable deletion lives in `./safe-deletion.ts`: entries keep a "Formerly" line first.
