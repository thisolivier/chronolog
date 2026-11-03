import { eq, and } from 'drizzle-orm';
import { database, clients } from '$lib/server/db';
import { decryptText, encryptNullable, encryptText } from '$lib/server/crypto/server-cipher';

export type ClientUpdateData = {
	name?: string;
	shortCode?: string;
	emoji?: string | null;
	colorIndex?: number;
};

type ClientRow = typeof clients.$inferSelect;

/** `clients.name` is encrypted at rest; every row leaving this module is decrypted. */
function decryptClient(row: ClientRow): ClientRow {
	return { ...row, name: decryptText(row.name, 'clients.name') };
}

function decryptOptionalClient(row: ClientRow | undefined): ClientRow | null {
	return row ? decryptClient(row) : null;
}

/** Locale-aware name ordering, done in memory because the column holds ciphertext. */
export function compareNames(left: string, right: string): number {
	return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

export async function listClientsForUser(userId: string) {
	const rows = await database.select().from(clients).where(eq(clients.userId, userId));
	return rows.map(decryptClient).sort((left, right) => compareNames(left.name, right.name));
}

export async function getClientForUser(clientId: string, userId: string) {
	const results = await database
		.select()
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.limit(1);
	return decryptOptionalClient(results[0]);
}

export async function createClient(
	userId: string,
	name: string,
	shortCode: string,
	emoji?: string | null,
	colorIndex?: number
) {
	const results = await database
		.insert(clients)
		.values({
			userId,
			name: encryptText(name),
			shortCode,
			emoji: emoji ?? null,
			colorIndex: colorIndex ?? 0
		})
		.returning();
	return decryptClient(results[0]);
}

export async function updateClient(clientId: string, userId: string, data: ClientUpdateData) {
	const results = await database
		.update(clients)
		.set({ ...data, name: encryptNullable(data.name), updatedAt: new Date() })
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.returning();
	return decryptOptionalClient(results[0]);
}

export async function deleteClient(clientId: string, userId: string) {
	const results = await database
		.delete(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.returning();
	return decryptOptionalClient(results[0]);
}
