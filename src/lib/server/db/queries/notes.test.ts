import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { database, clients, contracts, notes, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import {
	getNextNoteId,
	createNoteForUser,
	searchNotesForUser,
	updateNoteForUser,
	NoteConflictError
} from './notes';
import { rankNoteMatch } from './note-search';

describe('Note ID Generation', () => {
	let testUserId: string;
	let testClientId: string;
	let testContractId: string;

	beforeAll(async () => {
		// Create a test user
		testUserId = `test-notes-${Date.now()}`;
		await database
			.insert(users)
			.values({
				id: testUserId,
				name: 'Test User',
				email: `${testUserId}@example.com`
			});

		// Create a test client
		const clientResult = await database
			.insert(clients)
			.values({
				userId: testUserId,
				name: 'Test Client',
				shortCode: 'TEST'
			})
			.returning();
		testClientId = clientResult[0].id;

		// Create a test contract
		const contractResult = await database
			.insert(contracts)
			.values({
				clientId: testClientId,
				name: 'Test Contract',
				isActive: true
			})
			.returning();
		testContractId = contractResult[0].id;
	});

	afterAll(async () => {
		// Clean up in reverse order
		await database.delete(notes).where(eq(notes.userId, testUserId));
		await database.delete(contracts).where(eq(contracts.id, testContractId));
		await database.delete(clients).where(eq(clients.id, testClientId));
		await database.delete(users).where(eq(users.id, testUserId));
	});

	it('should generate note ID with correct format', async () => {
		const noteId = await getNextNoteId(testContractId);

		// Should match: SHORTCODE.YYYYMMDD.SEQ
		const pattern = /^TEST\.\d{8}\.\d{3}$/;
		expect(noteId).toMatch(pattern);

		// First note should end with .001
		expect(noteId).toMatch(/\.001$/);
	});

	it('should increment sequence number for same client+date', async () => {
		// Create first note
		const note1 = await createNoteForUser(
			testUserId,
			testContractId,
			'First Note',
			'Content',
			'{"type":"doc","content":[]}'
		);

		// Create second note
		const note2 = await createNoteForUser(
			testUserId,
			testContractId,
			'Second Note',
			'Content',
			'{"type":"doc","content":[]}'
		);

		// Extract sequence numbers
		const seq1 = parseInt(note1.id.split('.')[2], 10);
		const seq2 = parseInt(note2.id.split('.')[2], 10);

		expect(seq2).toBe(seq1 + 1);

		// Both should have the same date and client code
		const [code1, date1] = note1.id.split('.');
		const [code2, date2] = note2.id.split('.');

		expect(code1).toBe(code2);
		expect(date1).toBe(date2);
	});

	it('should use client short code from contract', async () => {
		const noteId = await getNextNoteId(testContractId);
		expect(noteId).toMatch(/^TEST\./);
	});
});

describe('searchNotesForUser', () => {
	const uniqueSuffix = Date.now().toString();
	let testUserId: string;
	let testClientId: string;
	let testContractId: string;
	let createdNoteId: string;

	const firstParagraph = `Kickoff with Acme ${uniqueSuffix}`;
	const secondParagraph = `Discussed zebra pricing ${uniqueSuffix}`;

	beforeAll(async () => {
		testUserId = `test-notes-search-${uniqueSuffix}`;
		await database.insert(users).values({
			id: testUserId,
			name: 'Search Test User',
			email: `${testUserId}@example.com`
		});

		const clientResult = await database
			.insert(clients)
			.values({ userId: testUserId, name: 'Search Client', shortCode: 'SRCH' })
			.returning();
		testClientId = clientResult[0].id;

		const contractResult = await database
			.insert(contracts)
			.values({ clientId: testClientId, name: 'Search Contract', isActive: true })
			.returning();
		testContractId = contractResult[0].id;

		const contentJson = JSON.stringify({
			type: 'doc',
			content: [
				{ type: 'paragraph', content: [{ type: 'text', text: firstParagraph }] },
				{ type: 'paragraph', content: [{ type: 'text', text: secondParagraph }] }
			]
		});
		const createdNote = await createNoteForUser(
			testUserId,
			testContractId,
			`Alpha title ${uniqueSuffix}`,
			`${firstParagraph}\n\n${secondParagraph}`,
			contentJson
		);
		createdNoteId = createdNote.id;
	});

	afterAll(async () => {
		await database.delete(notes).where(eq(notes.userId, testUserId));
		await database.delete(contracts).where(eq(contracts.id, testContractId));
		await database.delete(clients).where(eq(clients.id, testClientId));
		await database.delete(users).where(eq(users.id, testUserId));
	});

	it('returns firstLine and secondLine previews for a title match', async () => {
		const results = await searchNotesForUser(testUserId, `Alpha title ${uniqueSuffix}`);

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe(createdNoteId);
		expect(results[0].firstLine).toBe(firstParagraph);
		expect(results[0].secondLine).toBe(secondParagraph);
	});

	it('finds a note whose body content matches but whose id and title do not', async () => {
		const results = await searchNotesForUser(testUserId, `zebra pricing ${uniqueSuffix}`);

		expect(results.map((note) => note.id)).toContain(createdNoteId);
	});

	it('matches case-insensitively and returns nothing for an unknown term', async () => {
		const upperCaseResults = await searchNotesForUser(testUserId, `ZEBRA PRICING ${uniqueSuffix}`);
		expect(upperCaseResults.map((note) => note.id)).toContain(createdNoteId);

		const missingResults = await searchNotesForUser(testUserId, `no-such-term-${uniqueSuffix}`);
		expect(missingResults).toHaveLength(0);
	});

	it('ranks an exact ID match first even when a newer note mentions that ID (R2)', async () => {
		const mentioningNote = await createNoteForUser(
			testUserId,
			testContractId,
			'',
			`See [[${createdNoteId}]] for context`,
			JSON.stringify({ type: 'doc', content: [] })
		);
		const results = await searchNotesForUser(testUserId, createdNoteId);
		expect(results[0].id).toBe(createdNoteId);
		expect(results.map((note) => note.id)).toContain(mentioningNote.id);
	});

	it('excludes the note being edited and returns contract details', async () => {
		const results = await searchNotesForUser(testUserId, `zebra pricing ${uniqueSuffix}`, {
			excludeNoteId: createdNoteId
		});
		expect(results.map((note) => note.id)).not.toContain(createdNoteId);

		const withContract = await searchNotesForUser(testUserId, createdNoteId);
		expect(withContract[0]).toMatchObject({
			contractName: 'Search Contract',
			clientName: 'Search Client',
			clientShortCode: 'SRCH',
			displayTitle: `Alpha title ${uniqueSuffix}`
		});
	});

	it('returns recent notes for an empty query', async () => {
		const results = await searchNotesForUser(testUserId, '');
		expect(results.length).toBeGreaterThan(0);
	});
});

describe('rankNoteMatch', () => {
	it('orders exact id, id prefix, title, id substring, body', () => {
		const rank = (needle: string) => rankNoteMatch(needle, 'ACME.20261103.002', 'Kickoff plan', 'body text');
		expect(rank('acme.20261103.002')).toBe(0);
		expect(rank('acme.2026')).toBe(1);
		expect(rank('kickoff')).toBe(2);
		expect(rank('1103.002')).toBe(3);
		expect(rank('body')).toBe(4);
		expect(rank('nothing')).toBeNull();
	});
});

describe('updateNoteForUser conflict detection', () => {
	const suffix = `${Date.now()}-conflict`;
	const userId = `test-notes-conflict-${suffix}`;
	let clientId: string;
	let contractId: string;

	beforeAll(async () => {
		await database.insert(users).values({ id: userId, name: 'Conflict', email: `${userId}@example.com` });
		clientId = (await database.insert(clients).values({ userId, name: 'Conflict Client', shortCode: 'CNFL' }).returning())[0].id;
		contractId = (await database.insert(contracts).values({ clientId, name: 'Conflict Contract', isActive: true }).returning())[0].id;
	});

	afterAll(async () => {
		await database.delete(notes).where(eq(notes.userId, userId));
		await database.delete(contracts).where(eq(contracts.id, contractId));
		await database.delete(clients).where(eq(clients.id, clientId));
		await database.delete(users).where(eq(users.id, userId));
	});

	it('saves when expectedUpdatedAt matches, even for a freshly created note', async () => {
		const created = await createNoteForUser(userId, contractId, 'one', 'one', undefined);
		const updated = await updateNoteForUser(userId, created.id, 'two', 'two', undefined, undefined, new Date(created.updatedAt));
		expect(updated?.content).toBe('two');
		const again = await updateNoteForUser(userId, created.id, 'three', 'three', undefined, undefined, new Date(updated!.updatedAt));
		expect(again?.content).toBe('three');
	});

	it('refuses a save based on an outdated copy', async () => {
		const created = await createNoteForUser(userId, contractId, 'base', 'base', undefined);
		const staleTimestamp = new Date(created.updatedAt);
		await updateNoteForUser(userId, created.id, 'tab one', 'tab one', undefined, undefined, staleTimestamp);
		await expect(
			updateNoteForUser(userId, created.id, 'tab two', 'tab two', undefined, undefined, staleTimestamp)
		).rejects.toBeInstanceOf(NoteConflictError);
	});
});
