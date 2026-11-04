/**
 * The user's manual client order (sprint 039-CL): the sidebar's drag and Alt+Arrow moves, and
 * `chronolog client edit <client> --order <n>`. Clients sort by `sortOrder`, then name. Names are
 * encrypted at rest, so the order is worked out in memory and written back as 0..n-1.
 */
import { and, eq, sql } from 'drizzle-orm';
import { database, clients } from '$lib/server/db';
import { decryptText } from '$lib/server/crypto/server-cipher';

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

/** Locale-aware name ordering, as `compareNames` in clients.ts (kept here to avoid an import cycle). */
function compareNames(left: string, right: string): number {
	return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

/** Sidebar order: manual `sortOrder` first, then name (all-zero orders, i.e. never reordered, read by name). */
export function compareClientOrder(
	left: { sortOrder: number; name: string },
	right: { sortOrder: number; name: string }
): number {
	return left.sortOrder - right.sortOrder || compareNames(left.name, right.name);
}

interface OrderedClient {
	id: string;
	name: string;
	sortOrder: number;
	archived: boolean;
}

/** The user's clients (never the system one) in their current order, locked until the transaction ends. */
async function lockClientsInOrder(transaction: Transaction, userId: string): Promise<OrderedClient[]> {
	const rows = await transaction
		.select({ id: clients.id, name: clients.name, sortOrder: clients.sortOrder, archivedAt: clients.archivedAt })
		.from(clients)
		.where(and(eq(clients.userId, userId), eq(clients.isSystem, false)))
		.for('update');
	return rows
		.map((row) => ({
			id: row.id,
			name: decryptText(row.name, 'clients.name'),
			sortOrder: row.sortOrder,
			archived: row.archivedAt !== null
		}))
		.sort(compareClientOrder);
}

async function writeOrder(transaction: Transaction, current: OrderedClient[], orderedIds: string[]) {
	const sortOrderById = new Map(current.map((client) => [client.id, client.sortOrder]));
	for (const [index, clientId] of orderedIds.entries()) {
		if (sortOrderById.get(clientId) === index) continue;
		await transaction.update(clients).set({ sortOrder: index }).where(eq(clients.id, clientId));
	}
}

/**
 * Persist an order: the listed clients first, in the given order, then the user's other clients
 * (the sidebar sends its active clients; archived ones follow) in their current order. Every ID
 * must be one of the user's own clients, listed once; otherwise nothing is written and `false`
 * is returned.
 */
export async function reorderClientsForUser(userId: string, orderedClientIds: string[]): Promise<boolean> {
	if (new Set(orderedClientIds).size !== orderedClientIds.length) return false;
	return database.transaction(async (transaction) => {
		const current = await lockClientsInOrder(transaction, userId);
		const ownedIds = new Set(current.map((client) => client.id));
		if (!orderedClientIds.every((clientId) => ownedIds.has(clientId))) return false;
		const listed = new Set(orderedClientIds);
		const fullOrder = [...orderedClientIds, ...current.filter((client) => !listed.has(client.id)).map((client) => client.id)];
		await writeOrder(transaction, current, fullOrder);
		return true;
	});
}

/**
 * Move one client to `position` (1 = top) among the user's active clients, as the sidebar shows
 * them (an archived client moves among all clients). Positions past the end mean last. Returns
 * the client's position after the move, or null when the client is not the user's.
 */
export async function moveClientToPosition(userId: string, clientId: string, position: number): Promise<number | null> {
	return database.transaction(async (transaction) => {
		const current = await lockClientsInOrder(transaction, userId);
		const moving = current.find((client) => client.id === clientId);
		if (!moving) return null;
		const visible = current.filter((client) => moving.archived || !client.archived).map((client) => client.id);
		const others = visible.filter((id) => id !== clientId);
		const targetIndex = Math.min(Math.max(position, 1), others.length + 1) - 1;
		others.splice(targetIndex, 0, clientId);
		const listed = new Set(others);
		await writeOrder(transaction, current, [...others, ...current.filter((client) => !listed.has(client.id)).map((client) => client.id)]);
		return targetIndex + 1;
	});
}

/**
 * `sortOrder` for a new client: 0 while the user has never reordered (all 0, so it lands by name),
 * else after the last one.
 */
export async function nextClientSortOrder(userId: string): Promise<number> {
	const [row] = await database
		.select({ highest: sql<number | null>`max(${clients.sortOrder})` })
		.from(clients)
		.where(and(eq(clients.userId, userId), eq(clients.isSystem, false)));
	const highest = row?.highest === null || row?.highest === undefined ? 0 : Number(row.highest);
	return highest > 0 ? highest + 1 : 0;
}
