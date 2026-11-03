import { eq, and, isNull } from 'drizzle-orm';
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

/**
 * A user's clients, name-ordered. The system "Deleted Client" is never listed; archived clients
 * are left out unless `includeArchived` (the admin list shows them so they can be restored).
 */
export async function listClientsForUser(
	userId: string,
	{ includeArchived = false }: { includeArchived?: boolean } = {}
) {
	const rows = await database
		.select()
		.from(clients)
		.where(
			and(
				eq(clients.userId, userId),
				eq(clients.isSystem, false),
				includeArchived ? undefined : isNull(clients.archivedAt)
			)
		);
	return rows.map(decryptClient).sort((left, right) => compareNames(left.name, right.name));
}

/** One of the user's own (non-system) clients, archived or not. */
export async function getClientForUser(clientId: string, userId: string) {
	const results = await database
		.select()
		.from(clients)
		.where(
			and(eq(clients.id, clientId), eq(clients.userId, userId), eq(clients.isSystem, false))
		)
		.limit(1);
	return decryptOptionalClient(results[0]);
}

/** Archive (hide from selects and the sidebar, keep all data) or restore a client. */
export async function setClientArchived(clientId: string, userId: string, archived: boolean) {
	const results = await database
		.update(clients)
		.set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
		.where(
			and(eq(clients.id, clientId), eq(clients.userId, userId), eq(clients.isSystem, false))
		)
		.returning();
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
		.where(
			and(eq(clients.id, clientId), eq(clients.userId, userId), eq(clients.isSystem, false))
		)
		.returning();
	return decryptOptionalClient(results[0]);
}

// Client deletion lives in `./safe-deletion.ts`: it reassigns entries and notes first.
