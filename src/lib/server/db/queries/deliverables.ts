import { eq, and } from 'drizzle-orm';
import { database, deliverables } from '$lib/server/db';

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
	sortOrder: number,
	userId: string
) {
	const results = await database
		.insert(deliverables)
		.values({ contractId, name, sortOrder, userId })
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

export async function deleteDeliverable(deliverableId: string, contractId: string) {
	const results = await database
		.delete(deliverables)
		.where(and(eq(deliverables.id, deliverableId), eq(deliverables.contractId, contractId)))
		.returning();
	return results[0] ?? null;
}
