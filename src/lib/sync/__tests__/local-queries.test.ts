/**
 * Tests for Local Query Helpers
 *
 * Verifies that the local query functions produce the same data shapes
 * as the server APIs, using the MockStorageAdapter.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorageAdapter } from './mock-storage-adapter';
import {
	queryContractsByClient,
	queryNotesForContract,
	queryNoteById,
	queryWeeklyTimeEntries,
	generateNoteIdLocally
} from '../local-queries';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const testClient = {
	id: 'client-1',
	userId: 'user-1',
	name: 'Acme Corp',
	shortCode: 'ACME',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
};

const testContract = {
	id: 'contract-1',
	clientId: 'client-1',
	name: 'Website Redesign',
	description: null,
	isActive: true,
	sortOrder: 1,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
};

const secondContract = {
	id: 'contract-2',
	clientId: 'client-1',
	name: 'API Development',
	description: null,
	isActive: true,
	sortOrder: 0,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
};

const testNote = {
	id: 'ACME.20260207.001',
	userId: 'user-1',
	contractId: 'contract-1',
	title: 'Test Note',
	content: 'Hello world',
	contentJson: JSON.stringify({
		type: 'doc',
		content: [
			{ type: 'paragraph', content: [{ type: 'text', text: 'First line content' }] },
			{ type: 'paragraph', content: [{ type: 'text', text: 'Second line content' }] }
		]
	}),
	wordCount: 4,
	isPinned: false,
	createdAt: '2026-02-07T10:00:00.000Z',
	updatedAt: '2026-02-07T10:00:00.000Z'
};

const pinnedNote = {
	id: 'ACME.20260206.001',
	userId: 'user-1',
	contractId: 'contract-1',
	title: 'Pinned Note',
	content: 'Important',
	contentJson: JSON.stringify({
		type: 'doc',
		content: [
			{ type: 'paragraph', content: [{ type: 'text', text: 'Important note' }] }
		]
	}),
	wordCount: 2,
	isPinned: true,
	createdAt: '2026-02-06T08:00:00.000Z',
	updatedAt: '2026-02-06T08:00:00.000Z'
};

const testTimeEntry = {
	id: 'entry-1',
	userId: 'user-1',
	contractId: 'contract-1',
	deliverableId: null,
	workTypeId: null,
	date: '2026-02-03',
	startTime: '09:00:00',
	endTime: '10:30:00',
	durationMinutes: 90,
	description: 'Working on homepage',
	isDraft: false,
	createdAt: '2026-02-03T09:00:00.000Z',
	updatedAt: '2026-02-03T10:30:00.000Z'
};

const draftTimeEntry = {
	id: 'entry-draft',
	userId: 'user-1',
	contractId: 'contract-1',
	deliverableId: null,
	workTypeId: null,
	date: '2026-02-03',
	startTime: '14:00:00',
	endTime: null,
	durationMinutes: 0,
	description: null,
	isDraft: true,
	createdAt: '2026-02-03T14:00:00.000Z',
	updatedAt: '2026-02-03T14:00:00.000Z'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('queryContractsByClient', () => {
	let storage: MockStorageAdapter;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		await storage.put('clients', testClient);
		await storage.put('contracts', testContract);
		await storage.put('contracts', secondContract);
		await storage.put('notes', testNote);
	});

	it('should join contracts with clients and count notes', async () => {
		const results = await queryContractsByClient(storage);

		expect(results).toHaveLength(2);

		// Should be sorted by sortOrder (secondContract has 0, testContract has 1)
		expect(results[0].id).toBe('contract-2');
		expect(results[1].id).toBe('contract-1');

		// testContract should have 1 note
		expect(results[1].noteCount).toBe(1);
		expect(results[1].clientName).toBe('Acme Corp');
		expect(results[1].clientShortCode).toBe('ACME');

		// secondContract should have 0 notes
		expect(results[0].noteCount).toBe(0);
	});

	it('should return empty array when no contracts exist', async () => {
		const emptyStorage = new MockStorageAdapter();
		await emptyStorage.init();
		const results = await queryContractsByClient(emptyStorage);
		expect(results).toEqual([]);
	});

	it('should skip contracts without a matching client', async () => {
		const orphanContract = {
			...testContract,
			id: 'orphan',
			clientId: 'nonexistent'
		};
		await storage.put('contracts', orphanContract);

		const results = await queryContractsByClient(storage);
		// Should still only have the 2 original contracts
		expect(results).toHaveLength(2);
	});
});

describe('queryNotesForContract', () => {
	let storage: MockStorageAdapter;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		await storage.put('notes', testNote);
		await storage.put('notes', pinnedNote);
	});

	it('should return notes for a specific contract', async () => {
		const results = await queryNotesForContract(storage, 'contract-1');
		expect(results).toHaveLength(2);
	});

	it('should sort pinned notes first', async () => {
		const results = await queryNotesForContract(storage, 'contract-1');
		expect(results[0].isPinned).toBe(true);
		expect(results[0].id).toBe('ACME.20260206.001');
	});

	it('should extract preview lines from contentJson', async () => {
		const results = await queryNotesForContract(storage, 'contract-1');
		const unpinnedNote = results.find((note) => !note.isPinned)!;
		expect(unpinnedNote.firstLine).toBe('First line content');
		expect(unpinnedNote.secondLine).toBe('Second line content');
	});

	it('should return empty array for unknown contract', async () => {
		const results = await queryNotesForContract(storage, 'nonexistent');
		expect(results).toEqual([]);
	});
});

describe('queryNoteById', () => {
	let storage: MockStorageAdapter;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		await storage.put('notes', testNote);
	});

	it('should return full note detail', async () => {
		const result = await queryNoteById(storage, 'ACME.20260207.001');
		expect(result).not.toBeNull();
		expect(result!.id).toBe('ACME.20260207.001');
		expect(result!.title).toBe('Test Note');
		expect(result!.contractId).toBe('contract-1');
		expect(result!.wordCount).toBe(4);
	});

	it('should return null for nonexistent note', async () => {
		const result = await queryNoteById(storage, 'nonexistent');
		expect(result).toBeNull();
	});
});

describe('queryWeeklyTimeEntries', () => {
	let storage: MockStorageAdapter;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		await storage.put('clients', testClient);
		await storage.put('contracts', testContract);
		await storage.put('timeEntries', testTimeEntry);
		await storage.put('timeEntries', draftTimeEntry);
	});

	it('should group entries by week and day', async () => {
		const results = await queryWeeklyTimeEntries(storage, ['2026-02-02']);

		expect(results).toHaveLength(1);
		const week = results[0];
		expect(week.weekStart).toBe('2026-02-02');
		expect(week.days).toHaveLength(7);
		expect(week.weeklyTotalMinutes).toBe(90);
	});

	it('should exclude draft entries', async () => {
		const results = await queryWeeklyTimeEntries(storage, ['2026-02-02']);
		const week = results[0];

		// Monday Feb 3 should only have the non-draft entry
		const monday = week.days.find((day) => day.date === '2026-02-03');
		expect(monday!.entries).toHaveLength(1);
		expect(monday!.entries[0].id).toBe('entry-1');
	});

	it('should join entries with contract and client names', async () => {
		const results = await queryWeeklyTimeEntries(storage, ['2026-02-02']);
		const monday = results[0].days.find((day) => day.date === '2026-02-03')!;
		const entry = monday.entries[0];

		expect(entry.contractName).toBe('Website Redesign');
		expect(entry.clientName).toBe('Acme Corp');
		expect(entry.clientShortCode).toBe('ACME');
	});

	it('should set status to Unsubmitted when no weekly status exists', async () => {
		const results = await queryWeeklyTimeEntries(storage, ['2026-02-02']);
		expect(results[0].status).toBe('Unsubmitted');
	});

	it('should use status from weeklyStatuses table', async () => {
		await storage.put('weeklyStatuses', {
			id: 'ws-1',
			userId: 'user-1',
			weekStart: '2026-02-02',
			year: 2026,
			weekNumber: 6,
			status: 'Submitted',
			createdAt: '2026-02-08T00:00:00.000Z',
			updatedAt: '2026-02-08T00:00:00.000Z'
		});

		const results = await queryWeeklyTimeEntries(storage, ['2026-02-02']);
		expect(results[0].status).toBe('Submitted');
	});

	it('should handle empty weeks', async () => {
		const results = await queryWeeklyTimeEntries(storage, ['2026-01-26']);
		expect(results).toHaveLength(1);
		expect(results[0].weeklyTotalMinutes).toBe(0);
	});
});

describe('generateNoteIdLocally', () => {
	let storage: MockStorageAdapter;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		await storage.put('clients', testClient);
		await storage.put('contracts', testContract);
	});

	it('should generate an ID with correct format', async () => {
		const noteId = await generateNoteIdLocally(storage, 'contract-1');

		// Should match pattern: SHORTCODE.YYYYMMDD.SEQ
		expect(noteId).toMatch(/^ACME\.\d{8}\.001$/);
	});

	it('should increment sequence for existing notes on same day', async () => {
		// Add a note with today's date prefix
		const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
		await storage.put('notes', {
			...testNote,
			id: `ACME.${today}.001`
		});

		const noteId = await generateNoteIdLocally(storage, 'contract-1');
		expect(noteId).toBe(`ACME.${today}.002`);
	});

	it('should return fallback ID for nonexistent contract', async () => {
		const noteId = await generateNoteIdLocally(storage, 'nonexistent');
		expect(noteId).toMatch(/^offline-[a-f0-9]{8}-\d+$/);
	});
});
