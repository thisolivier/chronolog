import { eq, and } from 'drizzle-orm';
import { database, workTypes } from '$lib/server/db';

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

export async function deleteWorkType(workTypeId: string, deliverableId: string) {
	const results = await database
		.delete(workTypes)
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
