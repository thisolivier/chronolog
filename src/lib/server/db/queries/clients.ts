import { eq, and } from 'drizzle-orm';
import { database, clients } from '$lib/server/db';

export async function listClientsForUser(userId: string) {
	return database
		.select()
		.from(clients)
		.where(eq(clients.userId, userId))
		.orderBy(clients.name);
}

export async function getClientForUser(clientId: string, userId: string) {
	const results = await database
		.select()
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.limit(1);
	return results[0] ?? null;
}

export async function createClient(
	userId: string,
	name: string,
	shortCode: string,
	emoji?: string | null
) {
	const results = await database
		.insert(clients)
		.values({ userId, name, shortCode, emoji: emoji ?? null })
		.returning();
	return results[0];
}

export async function updateClient(
	clientId: string,
	userId: string,
	data: { name?: string; shortCode?: string; emoji?: string | null }
) {
	const results = await database
		.update(clients)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.returning();
	return results[0] ?? null;
}

export async function deleteClient(clientId: string, userId: string) {
	const results = await database
		.delete(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.returning();
	return results[0] ?? null;
}
