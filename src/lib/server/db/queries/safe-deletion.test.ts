import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import {
	database,
	users,
	clients,
	contracts,
	deliverables,
	workTypes,
	notes,
	timeEntries
} from '$lib/server/db';
import { createClient, listClientsForUser } from './clients';
import { createContract, listContractsWithClientForUser, setContractArchived } from './contracts';
import { createTimeEntry } from './time-entries';
import { decryptNullable } from '$lib/server/crypto/server-cipher';
import { createNoteForUser, getNoteForUser } from './notes';
import {
	deleteClientWithReassignment,
	deleteContractWithReassignment,
	deleteDeliverableWithNote,
	deleteWorkTypeWithNote,
	getContractUsage,
	getEntryCountsBy
} from './safe-deletion';

/** Real Postgres: deleting never loses entries or notes, and it is all-or-nothing. */
describe('safe deletion (Postgres)', () => {
	const uniqueSuffix = `${Date.now()}`;
	const testUserId = `test-safe-delete-${uniqueSuffix}`;
	const otherUserId = `test-safe-delete-other-${uniqueSuffix}`;
	const emptyDoc = JSON.stringify({ type: 'doc', content: [] });

	beforeAll(async () => {
		await database.insert(users).values([
			{ id: testUserId, name: 'Safe Delete', email: `${testUserId}@example.com` },
			{ id: otherUserId, name: 'Other', email: `${otherUserId}@example.com` }
		]);
	});

	afterAll(async () => {
		for (const userId of [testUserId, otherUserId]) {
			await database.delete(notes).where(eq(notes.userId, userId));
			await database.delete(timeEntries).where(eq(timeEntries.userId, userId));
			await database.delete(clients).where(eq(clients.userId, userId));
			await database.delete(users).where(eq(users.id, userId));
		}
	});

	/** Read an entry straight from the table (decrypting its description). */
	async function getTimeEntryForUser(entryId: string, userId: string) {
		const [row] = await database
			.select()
			.from(timeEntries)
			.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)));
		return row ? { ...row, description: decryptNullable(row.description, 'test') } : null;
	}

	async function seedContract(clientName: string, shortCode: string, contractName: string) {
		const client = await createClient(testUserId, clientName, shortCode);
		const contract = await createContract(client.id, contractName, null, true);
		const [deliverable] = await database
			.insert(deliverables)
			.values({ contractId: contract.id, name: 'Phase 1', sortOrder: 0 })
			.returning();
		const [workType] = await database
			.insert(workTypes)
			.values({ deliverableId: deliverable.id, name: 'Design', sortOrder: 0 })
			.returning();
		const entryWithDeliverable = await createTimeEntry({
			userId: testUserId,
			contractId: contract.id,
			deliverableId: deliverable.id,
			workTypeId: workType.id,
			date: '2026-11-02',
			durationMinutes: 90,
			description: 'Kickoff workshop'
		});
		const entryWithoutDescription = await createTimeEntry({
			userId: testUserId,
			contractId: contract.id,
			date: '2026-11-03',
			durationMinutes: 45,
			description: null
		});
		const note = await createNoteForUser(testUserId, contract.id, 'Kickoff notes', 'Agenda', emptyDoc);
		return { client, contract, deliverable, workType, entryWithDeliverable, entryWithoutDescription, note };
	}

	it('counts entries, minutes and notes per contract', async () => {
		const seeded = await seedContract('Count Co', `CNT${uniqueSuffix.slice(-4)}`, 'Counting');
		const usage = await getContractUsage([seeded.contract.id]);
		expect(usage.get(seeded.contract.id)).toEqual({ timeEntryCount: 2, totalMinutes: 135, noteCount: 1 });
		const byDeliverable = await getEntryCountsBy('deliverableId', [seeded.deliverable.id]);
		expect(byDeliverable.get(seeded.deliverable.id)).toEqual({ timeEntryCount: 1, totalMinutes: 90 });
	});

	it('deletes a contract by moving entries and notes to Deleted Client / Deleted Contract', async () => {
		const seeded = await seedContract('Acme Corp', `ACM${uniqueSuffix.slice(-4)}`, 'Rocket Build');

		const result = await deleteContractWithReassignment(seeded.contract.id, testUserId);
		expect(result).toEqual({ reassignedTimeEntryCount: 2, movedNoteCount: 1, deletedContractCount: 1 });

		const [contractRow] = await database.select().from(contracts).where(eq(contracts.id, seeded.contract.id));
		expect(contractRow).toBeUndefined();

		const movedEntry = await getTimeEntryForUser(seeded.entryWithDeliverable.id, testUserId);
		expect(movedEntry?.description).toBe(
			'Kickoff workshop\nFormerly: Acme Corp / Rocket Build / Phase 1 / Design'
		);
		expect(movedEntry?.durationMinutes).toBe(90);
		expect(movedEntry?.deliverableId).toBeNull();
		const bareEntry = await getTimeEntryForUser(seeded.entryWithoutDescription.id, testUserId);
		expect(bareEntry?.description).toBe('Formerly: Acme Corp / Rocket Build');

		const movedNote = await getNoteForUser(seeded.note.id, testUserId);
		expect(movedNote?.contractId).toBe(movedEntry?.contractId);

		const [systemContract] = await database
			.select({ isSystem: contracts.isSystem, clientIsSystem: clients.isSystem })
			.from(contracts)
			.innerJoin(clients, eq(contracts.clientId, clients.id))
			.where(eq(contracts.id, movedEntry!.contractId));
		expect(systemContract).toEqual({ isSystem: true, clientIsSystem: true });

		// System entities never show up in lists or selects
		const clientNames = (await listClientsForUser(testUserId)).map((client) => client.name);
		expect(clientNames).not.toContain('Deleted Client');
		const contractIds = (await listContractsWithClientForUser(testUserId)).map((row) => row.id);
		expect(contractIds).not.toContain(movedEntry!.contractId);
	});

	it('reuses one Deleted Contract per user across deletions', async () => {
		const first = await seedContract('First', `FST${uniqueSuffix.slice(-4)}`, 'One');
		const second = await seedContract('Second', `SND${uniqueSuffix.slice(-4)}`, 'Two');
		await deleteContractWithReassignment(first.contract.id, testUserId);
		await deleteContractWithReassignment(second.contract.id, testUserId);

		const systemClients = await database
			.select()
			.from(clients)
			.where(and(eq(clients.userId, testUserId), eq(clients.isSystem, true)));
		expect(systemClients).toHaveLength(1);
		const firstEntry = await getTimeEntryForUser(first.entryWithoutDescription.id, testUserId);
		const secondEntry = await getTimeEntryForUser(second.entryWithoutDescription.id, testUserId);
		expect(firstEntry?.contractId).toBe(secondEntry?.contractId);
	});

	it('deletes a client and all its contracts with reassignment', async () => {
		const seeded = await seedContract('Globex', `GLB${uniqueSuffix.slice(-4)}`, 'Data Audit');
		const extraContract = await createContract(seeded.client.id, 'Support', null, true);
		await createNoteForUser(testUserId, extraContract.id, 'Support note', 'x', emptyDoc);

		const result = await deleteClientWithReassignment(seeded.client.id, testUserId);
		expect(result).toEqual({ reassignedTimeEntryCount: 2, movedNoteCount: 2, deletedContractCount: 2 });
		const [clientRow] = await database.select().from(clients).where(eq(clients.id, seeded.client.id));
		expect(clientRow).toBeUndefined();
		expect((await getTimeEntryForUser(seeded.entryWithDeliverable.id, testUserId))?.description).toContain(
			'Formerly: Globex / Data Audit'
		);
	});

	it('refuses another user’s contract and changes nothing', async () => {
		const seeded = await seedContract('Private', `PRV${uniqueSuffix.slice(-4)}`, 'Mine');
		expect(await deleteContractWithReassignment(seeded.contract.id, otherUserId)).toBeNull();
		expect(await deleteClientWithReassignment(seeded.client.id, otherUserId)).toBeNull();
		expect((await getTimeEntryForUser(seeded.entryWithDeliverable.id, testUserId))?.contractId).toBe(
			seeded.contract.id
		);
	});

	it('rolls back everything when the reassignment fails part-way', async () => {
		const seeded = await seedContract('Rollback', `RBK${uniqueSuffix.slice(-4)}`, 'Atomic');
		// Entries move first, then notes. A trigger makes the notes move fail, after the entries
		// have already been rewritten inside the transaction.
		const triggerName = `refuse_note_move_${uniqueSuffix}`;
		await database.execute(
			sql.raw(`create or replace function ${triggerName}() returns trigger language plpgsql as $$
				begin raise exception 'note move refused'; end $$`)
		);
		await database.execute(
			sql.raw(`create trigger ${triggerName} before update on notes for each row
				when (old.contract_id = '${seeded.contract.id}') execute function ${triggerName}()`)
		);
		try {
			await expect(deleteContractWithReassignment(seeded.contract.id, testUserId)).rejects.toThrow();
		} finally {
			await database.execute(sql.raw(`drop trigger ${triggerName} on notes`));
			await database.execute(sql.raw(`drop function ${triggerName}()`));
		}

		const entry = await getTimeEntryForUser(seeded.entryWithDeliverable.id, testUserId);
		expect(entry?.contractId).toBe(seeded.contract.id);
		expect(entry?.description).toBe('Kickoff workshop');
		expect(entry?.deliverableId).toBe(seeded.deliverable.id);
		expect((await getNoteForUser(seeded.note.id, testUserId))?.contractId).toBe(seeded.contract.id);
		const [contractRow] = await database.select().from(contracts).where(eq(contracts.id, seeded.contract.id));
		expect(contractRow).toBeDefined();
	});

	it('the database refuses a direct contract delete while entries or notes exist', async () => {
		const seeded = await seedContract('Guarded', `GRD${uniqueSuffix.slice(-4)}`, 'No cascade');
		await expect(
			database.delete(contracts).where(eq(contracts.id, seeded.contract.id))
		).rejects.toThrow();
		expect((await getContractUsage([seeded.contract.id])).get(seeded.contract.id)?.timeEntryCount).toBe(2);
	});

	it('archived contracts keep data but leave the selects', async () => {
		const seeded = await seedContract('Archive Co', `ARC${uniqueSuffix.slice(-4)}`, 'Old work');
		await setContractArchived(seeded.contract.id, seeded.client.id, true);
		const contractIds = (await listContractsWithClientForUser(testUserId)).map((row) => row.id);
		expect(contractIds).not.toContain(seeded.contract.id);
		expect((await getContractUsage([seeded.contract.id])).get(seeded.contract.id)?.noteCount).toBe(1);
	});

	it('deleting a deliverable keeps a Formerly line on its entries', async () => {
		const seeded = await seedContract('Deliv Co', `DLV${uniqueSuffix.slice(-4)}`, 'Build');
		const result = await deleteDeliverableWithNote(seeded.deliverable.id, seeded.contract.id);
		expect(result).toEqual({ annotatedTimeEntryCount: 1 });
		const entry = await getTimeEntryForUser(seeded.entryWithDeliverable.id, testUserId);
		expect(entry?.description).toBe('Kickoff workshop\nFormerly: Phase 1 / Design');
		expect(entry?.deliverableId).toBeNull();
		expect(entry?.contractId).toBe(seeded.contract.id);
		expect(await deleteDeliverableWithNote(seeded.deliverable.id, seeded.contract.id)).toBeNull();
	});

	it('deleting a work type keeps a Formerly line on its entries', async () => {
		const seeded = await seedContract('Work Co', `WRK${uniqueSuffix.slice(-4)}`, 'Ops');
		const result = await deleteWorkTypeWithNote(seeded.workType.id, seeded.deliverable.id);
		expect(result).toEqual({ annotatedTimeEntryCount: 1 });
		const entry = await getTimeEntryForUser(seeded.entryWithDeliverable.id, testUserId);
		expect(entry?.description).toBe('Kickoff workshop\nFormerly: Phase 1 / Design');
		expect(entry?.deliverableId).toBe(seeded.deliverable.id);
		expect(entry?.workTypeId).toBeNull();
	});
});
