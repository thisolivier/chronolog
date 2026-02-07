import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { database, clients, contracts, notes, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { getNextNoteId, createNoteForUser } from './notes';

describe('Note ID Generation', () => {
	let testUserId: string;
	let testClientId: string;
	let testContractId: string;

	beforeAll(async () => {
		// Create a test user
		const userResult = await database
			.insert(users)
			.values({
				name: 'Test User',
				email: `test-notes-${Date.now()}@example.com`,
				passwordHash: 'test-hash'
			})
			.returning();
		testUserId = userResult[0].id;

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
