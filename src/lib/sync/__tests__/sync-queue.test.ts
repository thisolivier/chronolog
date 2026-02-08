/**
 * Tests for SyncQueue — Pending Mutation Storage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SyncQueue } from '../sync-queue';
import { MockStorageAdapter } from './mock-storage-adapter';

describe('SyncQueue', () => {
	let storage: MockStorageAdapter;
	let queue: SyncQueue;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		queue = new SyncQueue(storage);
	});

	describe('enqueue', () => {
		it('should add a mutation to the queue', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1', name: 'Test Client' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			const allMutations = await queue.getAll();
			expect(allMutations).toHaveLength(1);
			expect(allMutations[0].table).toBe('clients');
			expect(allMutations[0].entityId).toBe('client-1');
			expect(allMutations[0].operation).toBe('upsert');
		});

		it('should generate a unique ID for each mutation', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1', name: 'Client A' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-2',
				operation: 'upsert',
				data: { id: 'client-2', name: 'Client B' },
				timestamp: '2026-02-08T10:01:00.000Z'
			});

			const allMutations = await queue.getAll();
			expect(allMutations).toHaveLength(2);
			expect(allMutations[0].id).not.toBe(allMutations[1].id);
		});

		it('should preserve the mutation data', async () => {
			const mutationData = {
				id: 'entry-1',
				userId: 'user-1',
				contractId: 'contract-1',
				durationMinutes: 60,
				description: 'Test entry'
			};

			await queue.enqueue({
				table: 'timeEntries',
				entityId: 'entry-1',
				operation: 'upsert',
				data: mutationData,
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			const allMutations = await queue.getAll();
			expect(allMutations[0].data).toEqual(mutationData);
		});
	});

	describe('getAll', () => {
		it('should return empty array when queue is empty', async () => {
			const allMutations = await queue.getAll();
			expect(allMutations).toEqual([]);
		});

		it('should return mutations ordered by timestamp', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-3',
				operation: 'upsert',
				data: { id: 'client-3' },
				timestamp: '2026-02-08T12:00:00.000Z'
			});

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-2',
				operation: 'upsert',
				data: { id: 'client-2' },
				timestamp: '2026-02-08T11:00:00.000Z'
			});

			const allMutations = await queue.getAll();
			expect(allMutations).toHaveLength(3);
			expect(allMutations[0].entityId).toBe('client-1');
			expect(allMutations[1].entityId).toBe('client-2');
			expect(allMutations[2].entityId).toBe('client-3');
		});
	});

	describe('dequeue', () => {
		it('should remove a specific mutation by ID', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-2',
				operation: 'delete',
				data: { id: 'client-2' },
				timestamp: '2026-02-08T11:00:00.000Z'
			});

			const allMutations = await queue.getAll();
			await queue.dequeue(allMutations[0].id);

			const remainingMutations = await queue.getAll();
			expect(remainingMutations).toHaveLength(1);
			expect(remainingMutations[0].entityId).toBe('client-2');
		});

		it('should not throw when dequeuing a non-existent ID', async () => {
			await expect(
				queue.dequeue('non-existent-id')
			).resolves.not.toThrow();
		});
	});

	describe('clear', () => {
		it('should remove all mutations from the queue', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await queue.enqueue({
				table: 'notes',
				entityId: 'note-1',
				operation: 'upsert',
				data: { id: 'note-1' },
				timestamp: '2026-02-08T11:00:00.000Z'
			});

			await queue.clear();

			const allMutations = await queue.getAll();
			expect(allMutations).toEqual([]);
		});
	});

	describe('count', () => {
		it('should return 0 for an empty queue', async () => {
			expect(await queue.count()).toBe(0);
		});

		it('should return the number of pending mutations', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-2',
				operation: 'upsert',
				data: { id: 'client-2' },
				timestamp: '2026-02-08T11:00:00.000Z'
			});

			expect(await queue.count()).toBe(2);
		});

		it('should update after dequeue', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-2',
				operation: 'upsert',
				data: { id: 'client-2' },
				timestamp: '2026-02-08T11:00:00.000Z'
			});

			const allMutations = await queue.getAll();
			await queue.dequeue(allMutations[0].id);

			expect(await queue.count()).toBe(1);
		});
	});

	describe('mixed operations', () => {
		it('should handle upserts and deletes together', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1', name: 'New Client' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-2',
				operation: 'delete',
				data: { id: 'client-2' },
				timestamp: '2026-02-08T10:01:00.000Z'
			});

			await queue.enqueue({
				table: 'timeEntries',
				entityId: 'entry-1',
				operation: 'upsert',
				data: { id: 'entry-1', durationMinutes: 30 },
				timestamp: '2026-02-08T10:02:00.000Z'
			});

			const allMutations = await queue.getAll();
			expect(allMutations).toHaveLength(3);
			expect(allMutations[0].operation).toBe('upsert');
			expect(allMutations[1].operation).toBe('delete');
			expect(allMutations[2].operation).toBe('upsert');
			expect(allMutations[2].table).toBe('timeEntries');
		});
	});
});
