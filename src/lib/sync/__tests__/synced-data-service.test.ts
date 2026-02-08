/**
 * Tests for SyncedDataService
 *
 * Tests the main data service's initialization, online/offline fallback,
 * and write-through-and-queue patterns using mock storage and fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockStorageAdapter } from './mock-storage-adapter';

// ---------------------------------------------------------------------------
// Mock getStorage to return our test storage
// ---------------------------------------------------------------------------

let testStorage: MockStorageAdapter;

vi.mock('$lib/storage', () => ({
	getStorage: () => Promise.resolve(testStorage)
}));

// We need to import AFTER mocking
const { SyncedDataService } = await import('../synced-data-service.svelte');

// ---------------------------------------------------------------------------
// Test data
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

const testNote = {
	id: 'ACME.20260207.001',
	userId: 'user-1',
	contractId: 'contract-1',
	title: 'Test Note',
	content: 'Hello world',
	contentJson: '{"type":"doc","content":[]}',
	wordCount: 2,
	isPinned: false,
	createdAt: '2026-02-07T10:00:00.000Z',
	updatedAt: '2026-02-07T10:00:00.000Z'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFetchForSync() {
	return vi.fn().mockImplementation((url: string) => {
		if (url.includes('/api/sync/pull')) {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						clients: [],
						contracts: [],
						deliverables: [],
						workTypes: [],
						timeEntries: [],
						notes: [],
						noteLinks: [],
						noteTimeEntries: [],
						weeklyStatuses: [],
						attachments: [],
						serverTimestamp: '2026-02-08T12:00:00.000Z'
					})
			});
		}
		if (url.includes('/api/sync/push')) {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						applied: 0,
						conflicts: 0,
						serverTimestamp: '2026-02-08T12:00:00.000Z'
					})
			});
		}
		return Promise.resolve({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ error: 'Not found' })
		});
	}) as unknown as typeof globalThis.fetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncedDataService', () => {
	let service: InstanceType<typeof SyncedDataService>;

	beforeEach(async () => {
		testStorage = new MockStorageAdapter();
		await testStorage.init();

		// Seed storage with test data
		await testStorage.put('clients', testClient);
		await testStorage.put('contracts', testContract);
		await testStorage.put('notes', testNote);

		// Pre-set sync timestamp so initialize doesn't try initial sync
		await testStorage.setSyncMeta('lastSyncTimestamp', '2026-02-08T10:00:00.000Z');

		// Mock global fetch for sync calls during initialize
		const originalFetch = globalThis.fetch;
		globalThis.fetch = createMockFetchForSync();

		service = new SyncedDataService();
		await service.initialize();

		// Restore original fetch
		globalThis.fetch = originalFetch;
	});

	afterEach(() => {
		service.destroy();
		vi.restoreAllMocks();
	});

	describe('getContractsByClient', () => {
		it('should fall back to local storage when offline', async () => {
			// Mock fetch to fail (simulate offline)
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			const contracts = await service.getContractsByClient();

			expect(contracts).toHaveLength(1);
			expect(contracts[0].id).toBe('contract-1');
			expect(contracts[0].clientName).toBe('Acme Corp');
			expect(contracts[0].noteCount).toBe(1);
		});

		it('should use server response when online', async () => {
			const serverContracts = [
				{
					id: 'contract-1',
					name: 'Website Redesign',
					isActive: true,
					sortOrder: 1,
					clientId: 'client-1',
					clientName: 'Acme Corp',
					clientShortCode: 'ACME',
					noteCount: 5
				}
			];

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ contracts: serverContracts })
			}) as unknown as typeof globalThis.fetch;

			const contracts = await service.getContractsByClient();

			// Should return server data (noteCount = 5, not local 1)
			expect(contracts).toHaveLength(1);
			expect(contracts[0].noteCount).toBe(5);
		});
	});

	describe('getNotesForContract', () => {
		it('should fall back to local storage when fetch fails', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			const notes = await service.getNotesForContract('contract-1');

			expect(notes).toHaveLength(1);
			expect(notes[0].id).toBe('ACME.20260207.001');
		});
	});

	describe('getNoteById', () => {
		it('should return note from local storage when offline', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			const note = await service.getNoteById('ACME.20260207.001');

			expect(note).not.toBeNull();
			expect(note!.title).toBe('Test Note');
		});

		it('should return null for nonexistent note', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			const note = await service.getNoteById('nonexistent');
			expect(note).toBeNull();
		});
	});

	describe('createNote', () => {
		it('should create note locally when offline and queue mutation', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			const result = await service.createNote('contract-1');

			expect(result.note).toBeDefined();
			expect(result.note.id).toMatch(/^ACME\.\d{8}\.\d{3}$/);
			expect(result.note.contractId).toBe('contract-1');

			// Verify it was stored locally
			const storedNote = await testStorage.getById('notes', result.note.id);
			expect(storedNote).not.toBeNull();

			// Verify a mutation was queued
			const queueItems = await testStorage.getAllSyncQueueItems();
			expect(queueItems.length).toBeGreaterThan(0);
			const noteMutation = queueItems.find(
				(item) => item.table === 'notes' && item.entityId === result.note.id
			);
			expect(noteMutation).toBeDefined();
		});
	});

	describe('updateNote', () => {
		it('should update note locally when offline and queue mutation', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			const updated = await service.updateNote('ACME.20260207.001', {
				title: 'Updated Title'
			});

			expect(updated).not.toBeNull();
			expect(updated!.title).toBe('Updated Title');

			// Verify local storage was updated
			const storedNote = await testStorage.getById('notes', 'ACME.20260207.001');
			expect(storedNote!.title).toBe('Updated Title');

			// Verify mutation was queued
			const queueItems = await testStorage.getAllSyncQueueItems();
			const noteMutation = queueItems.find(
				(item) => item.table === 'notes' && item.entityId === 'ACME.20260207.001'
			);
			expect(noteMutation).toBeDefined();
			expect(noteMutation!.operation).toBe('upsert');
		});
	});

	describe('deleteNote', () => {
		it('should delete note locally when offline and queue mutation', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			await service.deleteNote('ACME.20260207.001');

			// Verify removed from local storage
			const storedNote = await testStorage.getById('notes', 'ACME.20260207.001');
			expect(storedNote).toBeNull();

			// Verify delete mutation was queued
			const queueItems = await testStorage.getAllSyncQueueItems();
			const deleteMutation = queueItems.find(
				(item) => item.table === 'notes' && item.operation === 'delete'
			);
			expect(deleteMutation).toBeDefined();
		});
	});

	describe('createTimeEntry', () => {
		it('should create entry locally when offline', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			const result = await service.createTimeEntry({
				date: '2026-02-08',
				durationMinutes: 60,
				contractId: 'contract-1',
				description: 'Test entry'
			});

			expect(result.id).toBeDefined();

			// Verify stored
			const storedEntry = await testStorage.getById('timeEntries', result.id);
			expect(storedEntry).not.toBeNull();
			expect(storedEntry!.durationMinutes).toBe(60);
			expect(storedEntry!.isDraft).toBe(false);
		});
	});

	describe('deleteTimeEntry', () => {
		it('should delete entry locally when offline', async () => {
			// First create an entry
			await testStorage.put('timeEntries', {
				id: 'entry-to-delete',
				userId: 'user-1',
				contractId: 'contract-1',
				deliverableId: null,
				workTypeId: null,
				date: '2026-02-08',
				startTime: null,
				endTime: null,
				durationMinutes: 30,
				description: null,
				isDraft: false,
				createdAt: '2026-02-08T10:00:00.000Z',
				updatedAt: '2026-02-08T10:00:00.000Z'
			});

			globalThis.fetch = vi.fn().mockRejectedValue(
				new TypeError('Failed to fetch')
			) as unknown as typeof globalThis.fetch;

			await service.deleteTimeEntry('entry-to-delete');

			const storedEntry = await testStorage.getById('timeEntries', 'entry-to-delete');
			expect(storedEntry).toBeNull();
		});
	});
});
