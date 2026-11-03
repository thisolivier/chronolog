import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database, users, clients, contracts, notes, timeEntries, attachments } from '$lib/server/db';
import { createClient, getClientForUser, listClientsForUser } from './clients';
import { createContract, listContractsWithClientForUser } from './contracts';
import { createTimeEntry, listTimeEntriesForWeek } from './time-entries';
import { createNoteForUser, getNoteForUser, searchNotesForUser } from './notes';
import { createAttachment, getAttachment, listAttachmentsForNote } from './attachments';

/** Writes go through the query modules; raw selects prove the database only holds ciphertext. */
describe('encryption at rest (Postgres)', () => {
	const uniqueSuffix = `${Date.now()}`;
	const testUserId = `test-encryption-${uniqueSuffix}`;
	const clientName = `Zebra Holdings ${uniqueSuffix}`;
	const contractName = `Secret retainer ${uniqueSuffix}`;
	const entryDescription = `Confidential migration work ${uniqueSuffix}`;
	const noteContent = `Board discussed the quokka acquisition ${uniqueSuffix}`;
	const attachmentBytes = Buffer.from(`png-bytes-${uniqueSuffix}`);
	let clientId: string;
	let contractId: string;
	let noteId: string;
	let attachmentId: string;

	beforeAll(async () => {
		await database.insert(users).values({ id: testUserId, name: 'Encryption Test', email: `${testUserId}@example.com` });
		clientId = (await createClient(testUserId, clientName, 'ZEBR')).id;
		await createClient(testUserId, `Aardvark ${uniqueSuffix}`, 'AARD');
		contractId = (await createContract(clientId, contractName, 'Private terms', true)).id;
		await createTimeEntry({ userId: testUserId, contractId, date: '2026-11-02', durationMinutes: 30, description: entryDescription });
		const note = await createNoteForUser(
			testUserId,
			contractId,
			`Quarterly review ${uniqueSuffix}`,
			noteContent,
			JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: noteContent }] }] })
		);
		noteId = note.id;
		attachmentId = (await createAttachment(noteId, 'board-minutes.png', 'image/png', attachmentBytes.length, attachmentBytes)).id;
	});

	afterAll(async () => {
		await database.delete(notes).where(eq(notes.userId, testUserId));
		await database.delete(timeEntries).where(eq(timeEntries.userId, testUserId));
		await database.delete(clients).where(eq(clients.userId, testUserId)); // cascades contracts
		await database.delete(users).where(eq(users.id, testUserId));
	});

	it('stores every sensitive column with the enc1: prefix', async () => {
		const [clientRow] = await database.select().from(clients).where(eq(clients.id, clientId));
		const [contractRow] = await database.select().from(contracts).where(eq(contracts.id, contractId));
		const [entryRow] = await database.select().from(timeEntries).where(eq(timeEntries.userId, testUserId));
		const [noteRow] = await database.select().from(notes).where(eq(notes.id, noteId));
		const [attachmentRow] = await database.select().from(attachments).where(eq(attachments.id, attachmentId));

		for (const storedValue of [
			clientRow.name,
			contractRow.name,
			contractRow.description,
			entryRow.description,
			noteRow.title,
			noteRow.content,
			noteRow.contentJson,
			attachmentRow.filename
		]) {
			expect(storedValue).toMatch(/^enc1:/);
		}
		expect(noteRow.content).not.toContain('quokka');
		expect(attachmentRow.data.subarray(0, 5).toString('ascii')).toBe('enc1:');
		expect(noteRow.id).toMatch(/^ZEBR\.\d{8}\.\d{3}$/); // note IDs stay plaintext
	});

	it('returns plaintext from the query modules', async () => {
		expect((await getClientForUser(clientId, testUserId))?.name).toBe(clientName);
		expect((await getNoteForUser(noteId, testUserId))?.content).toBe(noteContent);
		const [entry] = await listTimeEntriesForWeek(testUserId, '2026-11-02');
		expect(entry.description).toBe(entryDescription);
		expect(entry.clientName).toBe(clientName);
		expect(entry.contractName).toBe(contractName);
		const attachment = await getAttachment(attachmentId);
		expect(attachment?.filename).toBe('board-minutes.png');
		expect(attachment?.data.equals(attachmentBytes)).toBe(true);
		expect((await listAttachmentsForNote(noteId))[0].filename).toBe('board-minutes.png');
	});

	it('orders decrypted names in memory', async () => {
		const clientNames = (await listClientsForUser(testUserId)).map((client) => client.name);
		expect(clientNames).toEqual([`Aardvark ${uniqueSuffix}`, clientName]);
		const [contract] = await listContractsWithClientForUser(testUserId);
		expect(contract.clientName).toBe(clientName);
	});

	it('searches encrypted note content in memory, case-insensitively, capped by limit', async () => {
		const results = await searchNotesForUser(testUserId, `QUOKKA ACQUISITION ${uniqueSuffix}`);
		expect(results.map((note) => note.id)).toEqual([noteId]);
		expect(results[0].firstLine).toBe(noteContent);
		expect(await searchNotesForUser(testUserId, uniqueSuffix, 0)).toHaveLength(0);
	});
});
