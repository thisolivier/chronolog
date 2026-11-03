import { eq, and, sql } from 'drizzle-orm';
import { database, contracts, clients, notes } from '$lib/server/db';
import {
	decryptNullable,
	decryptText,
	encryptNullable,
	encryptText
} from '$lib/server/crypto/server-cipher';
import { compareNames } from './clients';

type ContractRow = typeof contracts.$inferSelect;

/** `contracts.name` and `contracts.description` are encrypted at rest. */
function decryptContract(row: ContractRow): ContractRow {
	return {
		...row,
		name: decryptText(row.name, 'contracts.name'),
		description: decryptNullable(row.description, 'contracts.description')
	};
}

function decryptOptionalContract(row: ContractRow | undefined): ContractRow | null {
	return row ? decryptContract(row) : null;
}

export async function listContractsForClient(clientId: string) {
	const rows = await database.select().from(contracts).where(eq(contracts.clientId, clientId));
	return rows.map(decryptContract).sort((left, right) => compareNames(left.name, right.name));
}

export async function getContractForClient(contractId: string, clientId: string) {
	const results = await database
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.clientId, clientId)))
		.limit(1);
	return decryptOptionalContract(results[0]);
}

export async function createContract(
	clientId: string,
	name: string,
	description: string | null,
	isActive: boolean
) {
	const results = await database
		.insert(contracts)
		.values({ clientId, name: encryptText(name), description: encryptNullable(description), isActive })
		.returning();
	return decryptContract(results[0]);
}

export async function updateContract(
	contractId: string,
	clientId: string,
	data: { name?: string; description?: string | null; isActive?: boolean }
) {
	const results = await database
		.update(contracts)
		.set({
			...data,
			name: encryptNullable(data.name),
			description: encryptNullable(data.description),
			updatedAt: new Date()
		})
		.where(and(eq(contracts.id, contractId), eq(contracts.clientId, clientId)))
		.returning();
	return decryptOptionalContract(results[0]);
}

export async function deleteContract(contractId: string, clientId: string) {
	const results = await database
		.delete(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.clientId, clientId)))
		.returning();
	return decryptOptionalContract(results[0]);
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

/** All of a user's contracts with client info, ordered by client name then contract name. */
export async function listContractsWithClientForUser(userId: string) {
	const rows = await database
		.select({
			id: contracts.id,
			name: contracts.name,
			isActive: contracts.isActive,
			clientId: contracts.clientId,
			clientName: clients.name,
			clientShortCode: clients.shortCode,
			clientColorIndex: clients.colorIndex
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(eq(clients.userId, userId));

	return rows
		.map((row) => ({
			...row,
			name: decryptText(row.name, 'contracts.name'),
			clientName: decryptText(row.clientName, 'clients.name')
		}))
		.sort(
			(left, right) =>
				compareNames(left.clientName, right.clientName) || compareNames(left.name, right.name)
		);
}

/** Flat contract list with client info and note count, ordered by sortOrder then name. */
export async function listContractsByClientWithNoteCount(userId: string) {
	const rows = await database
		.select({
			id: contracts.id,
			name: contracts.name,
			isActive: contracts.isActive,
			sortOrder: contracts.sortOrder,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode,
			clientEmoji: clients.emoji,
			clientColorIndex: clients.colorIndex,
			noteCount: sql<number>`cast(count(${notes.id}) as int)`
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.leftJoin(notes, eq(notes.contractId, contracts.id))
		.where(eq(clients.userId, userId))
		.groupBy(contracts.id, clients.id);

	return rows
		.map((row) => ({
			...row,
			name: decryptText(row.name, 'contracts.name'),
			clientName: decryptText(row.clientName, 'clients.name')
		}))
		.sort((left, right) => left.sortOrder - right.sortOrder || compareNames(left.name, right.name));
}
