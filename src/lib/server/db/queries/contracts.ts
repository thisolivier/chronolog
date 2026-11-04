import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
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

/** Sidebar / admin order: manual `sortOrder` first, then name (all-zero orders fall back to names). */
export function compareContractOrder(
	left: { sortOrder: number; name: string },
	right: { sortOrder: number; name: string }
): number {
	return left.sortOrder - right.sortOrder || compareNames(left.name, right.name);
}

/** Every contract of a client for the admin page, archived included, in display order. */
export async function listContractsForClient(clientId: string) {
	const rows = await database
		.select()
		.from(contracts)
		.where(and(eq(contracts.clientId, clientId), eq(contracts.isSystem, false)));
	return rows.map(decryptContract).sort(compareContractOrder);
}

export async function getContractForClient(contractId: string, clientId: string) {
	const results = await database
		.select()
		.from(contracts)
		.where(
			and(
				eq(contracts.id, contractId),
				eq(contracts.clientId, clientId),
				eq(contracts.isSystem, false)
			)
		)
		.limit(1);
	return decryptOptionalContract(results[0]);
}

/**
 * One of the user's own non-system contracts (archived or not), found through its client, with
 * the client's archive state (an archived client hides its contracts too). `null` when the
 * contract is missing or belongs to someone else, so API routes answer 404 either way.
 */
export async function getContractForUser(contractId: string, userId: string) {
	const results = await database
		.select({ contract: contracts, clientArchivedAt: clients.archivedAt })
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(
			and(eq(contracts.id, contractId), eq(clients.userId, userId), eq(contracts.isSystem, false))
		)
		.limit(1);
	const row = results[0];
	if (!row) return null;
	return { ...decryptContract(row.contract), clientArchivedAt: row.clientArchivedAt };
}

/** New contracts go to the end of their client's manual order. */
export async function createContract(
	clientId: string,
	name: string,
	description: string | null,
	isActive: boolean
) {
	const [{ highestSortOrder }] = await database
		.select({ highestSortOrder: sql<number | null>`max(${contracts.sortOrder})` })
		.from(contracts)
		.where(and(eq(contracts.clientId, clientId), eq(contracts.isSystem, false)));
	const results = await database
		.insert(contracts)
		.values({
			clientId,
			name: encryptText(name),
			description: encryptNullable(description),
			isActive,
			sortOrder: highestSortOrder === null ? 0 : Number(highestSortOrder) + 1
		})
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
		.where(
			and(
				eq(contracts.id, contractId),
				eq(contracts.clientId, clientId),
				eq(contracts.isSystem, false)
			)
		)
		.returning();
	return decryptOptionalContract(results[0]);
}

/** Archive (hide from selects and the sidebar, keep entries and notes) or restore a contract. */
export async function setContractArchived(contractId: string, clientId: string, archived: boolean) {
	return updateContractFields(contractId, clientId, { archivedAt: archived ? new Date() : null });
}

async function updateContractFields(
	contractId: string,
	clientId: string,
	fields: Partial<Pick<ContractRow, 'archivedAt' | 'sortOrder'>>
) {
	const results = await database
		.update(contracts)
		.set({ ...fields, updatedAt: new Date() })
		.where(
			and(
				eq(contracts.id, contractId),
				eq(contracts.clientId, clientId),
				eq(contracts.isSystem, false)
			)
		)
		.returning();
	return decryptOptionalContract(results[0]);
}

/**
 * Persist a manual order (BACKLOG Task 13): `orderedContractIds[index]` gets `sortOrder = index`.
 * Every ID must be one of the user's own contracts, otherwise nothing is written and `false`
 * is returned. Runs in one transaction so a half-applied order is never visible.
 */
export async function reorderContractsForUser(
	userId: string,
	orderedContractIds: string[]
): Promise<boolean> {
	if (orderedContractIds.length === 0) return true;
	if (new Set(orderedContractIds).size !== orderedContractIds.length) return false;

	return database.transaction(async (transaction) => {
		const ownedRows = await transaction
			.select({ id: contracts.id })
			.from(contracts)
			.innerJoin(clients, eq(contracts.clientId, clients.id))
			.where(
				and(
					eq(clients.userId, userId),
					eq(contracts.isSystem, false),
					inArray(contracts.id, orderedContractIds)
				)
			);
		if (ownedRows.length !== orderedContractIds.length) return false;

		for (const [index, contractId] of orderedContractIds.entries()) {
			await transaction
				.update(contracts)
				.set({ sortOrder: index, updatedAt: new Date() })
				.where(eq(contracts.id, contractId));
		}
		return true;
	});
}

// Contract deletion lives in `./safe-deletion.ts`: it reassigns entries and notes first.

/**
 * True when the contract exists and its client belongs to the user. Write routes
 * (`POST /api/notes`, `POST`/`PATCH /api/time-entries`) answer 403 otherwise (sprint 029-CL).
 */
export async function contractBelongsToUser(contractId: string, userId: string): Promise<boolean> {
	const results = await database
		.select({ id: contracts.id })
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(contracts.id, contractId), eq(clients.userId, userId)))
		.limit(1);
	return results.length > 0;
}

/** Verify that a client belongs to a user (used for authorization checks) */
export async function verifyClientOwnership(clientId: string, userId: string) {
	const results = await database
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId), eq(clients.isSystem, false)))
		.limit(1);
	return results.length > 0;
}

/**
 * Contracts that appear in selects and the sidebar: the user's own, not archived (neither the
 * contract nor its client), and never the system "Deleted Client / Deleted Contract".
 */
function visibleContractsForUser(userId: string) {
	return and(
		eq(clients.userId, userId),
		eq(clients.isSystem, false),
		eq(contracts.isSystem, false),
		isNull(clients.archivedAt),
		isNull(contracts.archivedAt)
	);
}

/** All of a user's visible contracts with client info, ordered by client name then contract name. */
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
		.where(visibleContractsForUser(userId));

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

/**
 * Visible contracts with client info and note count, ordered by sortOrder then name. With
 * `includeArchived`, archived contracts and the contracts of archived clients are listed too
 * (never the system contract); `archivedAt` / `clientArchivedAt` tell them apart.
 */
export async function listContractsByClientWithNoteCount(
	userId: string,
	{ includeArchived = false }: { includeArchived?: boolean } = {}
) {
	const rows = await database
		.select({
			id: contracts.id,
			name: contracts.name,
			isActive: contracts.isActive,
			sortOrder: contracts.sortOrder,
			archivedAt: contracts.archivedAt,
			clientId: clients.id,
			clientName: clients.name,
			clientShortCode: clients.shortCode,
			clientEmoji: clients.emoji,
			clientColorIndex: clients.colorIndex,
			clientArchivedAt: clients.archivedAt,
			noteCount: sql<number>`cast(count(${notes.id}) as int)`
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		// Trashed notes are not counted (sprint 037-CL)
		.leftJoin(notes, and(eq(notes.contractId, contracts.id), isNull(notes.deletedAt)))
		.where(
			includeArchived
				? and(eq(clients.userId, userId), eq(clients.isSystem, false), eq(contracts.isSystem, false))
				: visibleContractsForUser(userId)
		)
		.groupBy(contracts.id, clients.id);

	return rows
		.map((row) => ({
			...row,
			name: decryptText(row.name, 'contracts.name'),
			clientName: decryptText(row.clientName, 'clients.name')
		}))
		.sort(compareContractOrder);
}

/** ID and client of every non-system contract a user owns (archived included), for usage counts. */
export async function listContractRefsForUser(userId: string) {
	return database
		.select({ id: contracts.id, clientId: contracts.clientId })
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(clients.userId, userId), eq(contracts.isSystem, false)));
}
