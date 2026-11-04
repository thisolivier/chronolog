import { eq, and } from 'drizzle-orm';
import { database, workTypes, deliverables, contracts, clients } from '$lib/server/db';

/**
 * One of the user's work types with its deliverable's name and contract, found through the
 * deliverable, contract and client. `parentArchived` as for deliverables (work types have no
 * archive state of their own). `null` when missing or someone else's.
 */
export async function getWorkTypeForUser(workTypeId: string, userId: string) {
	const results = await database
		.select({
			workType: workTypes,
			deliverableName: deliverables.name,
			contractId: deliverables.contractId,
			contractArchivedAt: contracts.archivedAt,
			clientArchivedAt: clients.archivedAt
		})
		.from(workTypes)
		.innerJoin(deliverables, eq(workTypes.deliverableId, deliverables.id))
		.innerJoin(contracts, eq(deliverables.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(workTypes.id, workTypeId), eq(clients.userId, userId), eq(contracts.isSystem, false)))
		.limit(1);
	const row = results[0];
	if (!row) return null;
	return {
		...row.workType,
		deliverableName: row.deliverableName,
		contractId: row.contractId,
		parentArchived: Boolean(row.contractArchivedAt || row.clientArchivedAt)
	};
}

export async function listWorkTypesForDeliverable(deliverableId: string) {
	return database
		.select()
		.from(workTypes)
		.where(eq(workTypes.deliverableId, deliverableId))
		.orderBy(workTypes.sortOrder);
}

export async function createWorkType(
	deliverableId: string,
	name: string,
	sortOrder: number
) {
	const results = await database
		.insert(workTypes)
		.values({ deliverableId, name, sortOrder })
		.returning();
	return results[0];
}

export async function updateWorkType(
	workTypeId: string,
	deliverableId: string,
	data: { name?: string; sortOrder?: number }
) {
	const results = await database
		.update(workTypes)
		.set(data)
		.where(and(eq(workTypes.id, workTypeId), eq(workTypes.deliverableId, deliverableId)))
		.returning();
	return results[0] ?? null;
}

export async function reorderWorkTypes(
	deliverableId: string,
	orderedWorkTypeIds: string[]
) {
	for (let index = 0; index < orderedWorkTypeIds.length; index++) {
		await database
			.update(workTypes)
			.set({ sortOrder: index })
			.where(
				and(
					eq(workTypes.id, orderedWorkTypeIds[index]),
					eq(workTypes.deliverableId, deliverableId)
				)
			);
	}
}
