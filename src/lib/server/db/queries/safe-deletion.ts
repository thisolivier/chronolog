/**
 * Safe deletion of clients, contracts, deliverables and work types (sprint 026-CL, BACKLOG Task 15).
 *
 * Nothing billable disappears silently:
 * - Contract / client: every time entry moves to the user's system "Deleted Client / Deleted
 *   Contract" with "Formerly: Client / Contract[ / Deliverable]" appended to its description, and
 *   every note moves to the "Deleted Contract". Then the contract (and its deliverables and work
 *   types) or client is deleted. All of it happens in ONE transaction: any failure rolls back.
 * - Deliverable / work type: entries that used it keep "Formerly: <name>" in their description
 *   before the reference is cleared and the row deleted, also in one transaction.
 *
 * The database backs this up: `time_entries.contract_id` and `notes.contract_id` no longer
 * cascade, so a contract that still has entries or notes cannot be deleted by any other path.
 *
 * Descriptions and names are encrypted at rest, so the "Formerly" text is appended in memory
 * (decrypt, append, re-encrypt) row by row inside the transaction.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { clients } from '$lib/server/db/schema/clients';
import { contracts } from '$lib/server/db/schema/contracts';
import { deliverables } from '$lib/server/db/schema/deliverables';
import { workTypes } from '$lib/server/db/schema/work-types';
import { timeEntries } from '$lib/server/db/schema/time-entries';
import { notes } from '$lib/server/db/schema/notes';
import { decryptNullable, decryptText, encryptText } from '$lib/server/crypto/server-cipher';
import { appendFormerlyLine } from './formerly-line';

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

export const DELETED_CLIENT_NAME = 'Deleted Client';
export const DELETED_CONTRACT_NAME = 'Deleted Contract';
/** Short code of the system client; never used for note IDs (moved notes keep their IDs). */
export const DELETED_CLIENT_SHORT_CODE = '_DELETED';

export interface DeletionResult {
	reassignedTimeEntryCount: number;
	movedNoteCount: number;
	deletedContractCount: number;
}

/**
 * Find or create the user's system "Deleted Client" and its "Deleted Contract". Created lazily
 * on the first reassigning delete; partial unique indexes keep it to one of each per user even
 * when two deletions race (the loser's insert does nothing and it re-reads the winner's row).
 */
export async function ensureDeletedContract(transaction: Transaction, userId: string) {
	const findClient = () =>
		transaction
			.select({ id: clients.id })
			.from(clients)
			.where(and(eq(clients.userId, userId), eq(clients.isSystem, true)))
			.limit(1);

	let [systemClient] = await findClient();
	if (!systemClient) {
		await transaction
			.insert(clients)
			.values({
				userId,
				name: encryptText(DELETED_CLIENT_NAME),
				shortCode: DELETED_CLIENT_SHORT_CODE,
				isSystem: true
			})
			.onConflictDoNothing();
		[systemClient] = await findClient();
	}

	const findContract = () =>
		transaction
			.select({ id: contracts.id })
			.from(contracts)
			.where(and(eq(contracts.clientId, systemClient.id), eq(contracts.isSystem, true)))
			.limit(1);

	let [systemContract] = await findContract();
	if (!systemContract) {
		await transaction
			.insert(contracts)
			.values({
				clientId: systemClient.id,
				name: encryptText(DELETED_CONTRACT_NAME),
				isActive: false,
				isSystem: true
			})
			.onConflictDoNothing();
		[systemContract] = await findContract();
	}

	return { clientId: systemClient.id, contractId: systemContract.id };
}

/**
 * Move one contract's entries and notes to the Deleted Contract, then delete the contract.
 * Must run inside a transaction. The contract must already be verified as the user's own.
 */
async function reassignAndDeleteContract(
	transaction: Transaction,
	userId: string,
	contract: { id: string; name: string },
	clientName: string
): Promise<Omit<DeletionResult, 'deletedContractCount'>> {
	const target = await ensureDeletedContract(transaction, userId);

	const entryRows = await transaction
		.select({
			id: timeEntries.id,
			description: timeEntries.description,
			deliverableName: deliverables.name,
			workTypeName: workTypes.name
		})
		.from(timeEntries)
		.leftJoin(deliverables, eq(timeEntries.deliverableId, deliverables.id))
		.leftJoin(workTypes, eq(timeEntries.workTypeId, workTypes.id))
		.where(eq(timeEntries.contractId, contract.id));

	for (const entry of entryRows) {
		const formerLabel = [clientName, contract.name, entry.deliverableName, entry.workTypeName]
			.filter((part): part is string => Boolean(part))
			.join(' / ');
		const description = decryptNullable(entry.description, 'time_entries.description');
		await transaction
			.update(timeEntries)
			.set({
				contractId: target.contractId,
				deliverableId: null,
				workTypeId: null,
				description: encryptText(appendFormerlyLine(description, formerLabel)),
				updatedAt: new Date()
			})
			.where(eq(timeEntries.id, entry.id));
	}

	const movedNotes = await transaction
		.update(notes)
		.set({ contractId: target.contractId, updatedAt: new Date() })
		.where(eq(notes.contractId, contract.id))
		.returning({ id: notes.id });

	// Deliverables and work types cascade with the contract; no entry references them any more.
	await transaction.delete(contracts).where(eq(contracts.id, contract.id));

	return { reassignedTimeEntryCount: entryRows.length, movedNoteCount: movedNotes.length };
}

/** Load a non-system contract owned by `userId` (through its client), with decrypted names. */
async function loadOwnedContract(transaction: Transaction, contractId: string, userId: string) {
	const [row] = await transaction
		.select({ id: contracts.id, name: contracts.name, clientName: clients.name })
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(
			and(eq(contracts.id, contractId), eq(clients.userId, userId), eq(contracts.isSystem, false))
		)
		.limit(1)
		.for('update');
	if (!row) return null;
	return {
		id: row.id,
		name: decryptText(row.name, 'contracts.name'),
		clientName: decryptText(row.clientName, 'clients.name')
	};
}

/** Delete a contract, reassigning its entries and notes first. `null` when not found / not owned. */
export async function deleteContractWithReassignment(
	contractId: string,
	userId: string
): Promise<DeletionResult | null> {
	return database.transaction(async (transaction) => {
		const contract = await loadOwnedContract(transaction, contractId, userId);
		if (!contract) return null;
		const moved = await reassignAndDeleteContract(transaction, userId, contract, contract.clientName);
		return { ...moved, deletedContractCount: 1 };
	});
}

/** Delete a client and all its contracts, reassigning every entry and note first. */
export async function deleteClientWithReassignment(
	clientId: string,
	userId: string
): Promise<DeletionResult | null> {
	return database.transaction(async (transaction) => {
		const [client] = await transaction
			.select({ id: clients.id, name: clients.name })
			.from(clients)
			.where(and(eq(clients.id, clientId), eq(clients.userId, userId), eq(clients.isSystem, false)))
			.limit(1)
			.for('update');
		if (!client) return null;
		const clientName = decryptText(client.name, 'clients.name');

		const contractRows = await transaction
			.select({ id: contracts.id, name: contracts.name })
			.from(contracts)
			.where(eq(contracts.clientId, client.id));

		const result: DeletionResult = {
			reassignedTimeEntryCount: 0,
			movedNoteCount: 0,
			deletedContractCount: 0
		};
		for (const contractRow of contractRows) {
			const contract = { id: contractRow.id, name: decryptText(contractRow.name, 'contracts.name') };
			const moved = await reassignAndDeleteContract(transaction, userId, contract, clientName);
			result.reassignedTimeEntryCount += moved.reassignedTimeEntryCount;
			result.movedNoteCount += moved.movedNoteCount;
			result.deletedContractCount += 1;
		}

		await transaction.delete(clients).where(eq(clients.id, client.id));
		return result;
	});
}

/**
 * Delete a deliverable of `contractId`. Entries that used it keep "Formerly: Deliverable[ / Work
 * type]" in their description; their deliverable and work type are cleared. Returns the number of
 * entries annotated, or `null` when the deliverable is not on that contract.
 */
export async function deleteDeliverableWithNote(
	deliverableId: string,
	contractId: string
): Promise<{ annotatedTimeEntryCount: number } | null> {
	return database.transaction(async (transaction) => {
		const [deliverable] = await transaction
			.select({ id: deliverables.id, name: deliverables.name })
			.from(deliverables)
			.where(and(eq(deliverables.id, deliverableId), eq(deliverables.contractId, contractId)))
			.limit(1)
			.for('update');
		if (!deliverable) return null;

		const entryRows = await transaction
			.select({
				id: timeEntries.id,
				description: timeEntries.description,
				workTypeName: workTypes.name
			})
			.from(timeEntries)
			.leftJoin(workTypes, eq(timeEntries.workTypeId, workTypes.id))
			.where(eq(timeEntries.deliverableId, deliverable.id));

		for (const entry of entryRows) {
			const formerLabel = [deliverable.name, entry.workTypeName].filter(Boolean).join(' / ');
			await annotateEntry(transaction, entry, formerLabel, { deliverableId: null, workTypeId: null });
		}

		await transaction.delete(deliverables).where(eq(deliverables.id, deliverable.id));
		return { annotatedTimeEntryCount: entryRows.length };
	});
}

/** Delete a work type; entries that used it keep "Formerly: Deliverable / Work type". */
export async function deleteWorkTypeWithNote(
	workTypeId: string,
	deliverableId: string
): Promise<{ annotatedTimeEntryCount: number } | null> {
	return database.transaction(async (transaction) => {
		const [workType] = await transaction
			.select({ id: workTypes.id, name: workTypes.name, deliverableName: deliverables.name })
			.from(workTypes)
			.innerJoin(deliverables, eq(workTypes.deliverableId, deliverables.id))
			.where(and(eq(workTypes.id, workTypeId), eq(workTypes.deliverableId, deliverableId)))
			.limit(1);
		if (!workType) return null;

		const entryRows = await transaction
			.select({ id: timeEntries.id, description: timeEntries.description })
			.from(timeEntries)
			.where(eq(timeEntries.workTypeId, workType.id));

		for (const entry of entryRows) {
			const formerLabel = `${workType.deliverableName} / ${workType.name}`;
			await annotateEntry(transaction, entry, formerLabel, { workTypeId: null });
		}

		await transaction.delete(workTypes).where(eq(workTypes.id, workType.id));
		return { annotatedTimeEntryCount: entryRows.length };
	});
}

async function annotateEntry(
	transaction: Transaction,
	entry: { id: string; description: string | null },
	formerLabel: string,
	clearedFields: { deliverableId?: null; workTypeId?: null }
) {
	const description = decryptNullable(entry.description, 'time_entries.description');
	await transaction
		.update(timeEntries)
		.set({
			...clearedFields,
			description: encryptText(appendFormerlyLine(description, formerLabel)),
			updatedAt: new Date()
		})
		.where(eq(timeEntries.id, entry.id));
}

// ── Usage counts for the confirm dialogs ─────────────────────────────

export interface UsageCounts {
	timeEntryCount: number;
	totalMinutes: number;
	noteCount: number;
}

const EMPTY_USAGE: UsageCounts = { timeEntryCount: 0, totalMinutes: 0, noteCount: 0 };

/** Entry count, total minutes and note count per contract ID (contracts with no usage omitted). */
export async function getContractUsage(contractIds: string[]): Promise<Map<string, UsageCounts>> {
	const usage = new Map<string, UsageCounts>();
	if (contractIds.length === 0) return usage;

	const entryRows = await database
		.select({
			contractId: timeEntries.contractId,
			entryCount: sql<number>`cast(count(*) as int)`,
			totalMinutes: sql<number>`cast(coalesce(sum(${timeEntries.durationMinutes}), 0) as int)`
		})
		.from(timeEntries)
		.where(inArray(timeEntries.contractId, contractIds))
		.groupBy(timeEntries.contractId);
	const noteRows = await database
		.select({ contractId: notes.contractId, noteCount: sql<number>`cast(count(*) as int)` })
		.from(notes)
		.where(inArray(notes.contractId, contractIds))
		.groupBy(notes.contractId);

	for (const row of entryRows) {
		usage.set(row.contractId, {
			...EMPTY_USAGE,
			timeEntryCount: row.entryCount,
			totalMinutes: row.totalMinutes
		});
	}
	for (const row of noteRows) {
		usage.set(row.contractId, { ...(usage.get(row.contractId) ?? EMPTY_USAGE), noteCount: row.noteCount });
	}
	return usage;
}

/** Usage summed over a set of contracts (a client's). */
export function sumUsage(usageList: Iterable<UsageCounts>): UsageCounts {
	const total = { ...EMPTY_USAGE };
	for (const usage of usageList) {
		total.timeEntryCount += usage.timeEntryCount;
		total.totalMinutes += usage.totalMinutes;
		total.noteCount += usage.noteCount;
	}
	return total;
}

/** Number of entries (and their minutes) per deliverable / work type ID. */
export async function getEntryCountsBy(
	column: 'deliverableId' | 'workTypeId',
	ids: string[]
): Promise<Map<string, { timeEntryCount: number; totalMinutes: number }>> {
	const counts = new Map<string, { timeEntryCount: number; totalMinutes: number }>();
	if (ids.length === 0) return counts;
	const groupColumn = timeEntries[column];
	const rows = await database
		.select({
			id: groupColumn,
			entryCount: sql<number>`cast(count(*) as int)`,
			totalMinutes: sql<number>`cast(coalesce(sum(${timeEntries.durationMinutes}), 0) as int)`
		})
		.from(timeEntries)
		.where(inArray(groupColumn, ids))
		.groupBy(groupColumn);
	for (const row of rows) {
		if (row.id) counts.set(row.id, { timeEntryCount: row.entryCount, totalMinutes: row.totalMinutes });
	}
	return counts;
}
