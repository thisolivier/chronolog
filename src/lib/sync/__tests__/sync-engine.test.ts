/**
 * Tests for SyncEngine — Main Sync Orchestrator
 *
 * Uses a mock storage adapter and mock fetch to test the engine's
 * push/pull/sync orchestration without network or database access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '../sync-engine.svelte';
import { SyncQueue } from '../sync-queue';
import { SyncMetadata } from '../sync-metadata';
import { MockStorageAdapter } from './mock-storage-adapter';
import type { SyncPullResponse, SyncPushResponse } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFetch(
	responseBody: unknown,
	options: { status?: number; ok?: boolean } = {}
): typeof globalThis.fetch {
	const { status = 200, ok = true } = options;

	return vi.fn().mockResolvedValue({
		ok,
		status,
		json: () => Promise.resolve(responseBody),
		text: () => Promise.resolve(JSON.stringify(responseBody))
	} as Partial<Response>) as unknown as typeof globalThis.fetch;
}

function createNetworkErrorFetch(): typeof globalThis.fetch {
	return vi.fn().mockRejectedValue(
		new TypeError('Failed to fetch')
	) as unknown as typeof globalThis.fetch;
}

const emptyPullResponse: SyncPullResponse = {
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
};

const samplePushResponse: SyncPushResponse = {
	applied: 1,
	conflicts: 0,
	serverTimestamp: '2026-02-08T12:01:00.000Z'
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SyncEngine', () => {
	let storage: MockStorageAdapter;
	let queue: SyncQueue;
	let metadata: SyncMetadata;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		queue = new SyncQueue(storage);
		metadata = new SyncMetadata(storage);
	});

	describe('pull', () => {
		it('should pull and apply data to local storage', async () => {
			const pullResponse: SyncPullResponse = {
				...emptyPullResponse,
				clients: [
					{
						id: 'c1',
						userId: 'u1',
						name: 'Test Client',
						shortCode: 'TC',
						createdAt: '2026-02-08T10:00:00.000Z',
						updatedAt: '2026-02-08T10:00:00.000Z'
					}
				],
				serverTimestamp: '2026-02-08T12:00:00.000Z'
			};

			const mockFetch = createMockFetch(pullResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			const result = await engine.pull();

			expect(result.pulled).toBe(1);
			expect(result.errors).toHaveLength(0);

			// Verify data was stored locally
			const localClients = await storage.getAll('clients');
			expect(localClients).toHaveLength(1);
			expect(localClients[0].name).toBe('Test Client');
		});

		it('should update lastSyncTimestamp after pull', async () => {
			const mockFetch = createMockFetch(emptyPullResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			await engine.pull();

			const lastSync = await metadata.getLastSyncTimestamp();
			expect(lastSync).toBe('2026-02-08T12:00:00.000Z');
		});

		it('should pass since timestamp to server', async () => {
			await metadata.setLastSyncTimestamp('2026-02-08T10:00:00.000Z');

			const mockFetch = createMockFetch(emptyPullResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			await engine.pull();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('since='),
				expect.any(Object)
			);
		});

		it('should return errors on network failure', async () => {
			const mockFetch = createNetworkErrorFetch();
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			const result = await engine.pull();

			expect(result.errors).toHaveLength(1);
			expect(result.pulled).toBe(0);
		});

		it('should set authExpired on 401', async () => {
			const mockFetch = createMockFetch(
				{ error: 'Unauthorized' },
				{ status: 401, ok: false }
			);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			await engine.pull();

			expect(engine.authExpired).toBe(true);
		});
	});

	describe('push', () => {
		it('should push pending mutations and clear queue', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1', name: 'New Client' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			const mockFetch = createMockFetch(samplePushResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			const result = await engine.push();

			expect(result.pushed).toBe(1);
			expect(result.errors).toHaveLength(0);

			// Queue should be empty after successful push
			const remainingCount = await queue.count();
			expect(remainingCount).toBe(0);
		});

		it('should return early with zero pushed if queue is empty', async () => {
			const mockFetch = createMockFetch(samplePushResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			const result = await engine.push();

			expect(result.pushed).toBe(0);
			expect(result.errors).toHaveLength(0);

			// Fetch should not have been called
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('should keep mutations in queue on network error', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			const mockFetch = createNetworkErrorFetch();
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			const result = await engine.push();

			expect(result.errors).toHaveLength(1);

			// Queue should still have the mutation
			const remainingCount = await queue.count();
			expect(remainingCount).toBe(1);
		});

		it('should update pendingCount after push', async () => {
			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			const mockFetch = createMockFetch(samplePushResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			await engine.push();

			expect(engine.pendingCount).toBe(0);
		});
	});

	describe('sync', () => {
		it('should push then pull in order', async () => {
			const callOrder: string[] = [];

			// Track which endpoints are called and in what order
			const mockFetch = vi.fn().mockImplementation(
				(url: string) => {
					if (url.includes('/push')) {
						callOrder.push('push');
						return Promise.resolve({
							ok: true,
							status: 200,
							json: () => Promise.resolve(samplePushResponse),
							text: () => Promise.resolve('')
						});
					}
					callOrder.push('pull');
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve(emptyPullResponse),
						text: () => Promise.resolve('')
					});
				}
			) as unknown as typeof globalThis.fetch;

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			const engine = new SyncEngine(storage, queue, metadata, mockFetch);
			const result = await engine.sync();

			expect(callOrder).toEqual(['push', 'pull']);
			expect(result.pushed).toBe(1);
			expect(result.errors).toHaveLength(0);
		});

		it('should set state to syncing during sync', async () => {
			let stateWhileSyncing: string | null = null;

			const mockFetch = vi.fn().mockImplementation(() => {
				// This is a trick: capture state mid-sync inside the mock fetch
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(emptyPullResponse),
					text: () => Promise.resolve('')
				});
			}) as unknown as typeof globalThis.fetch;

			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			// Override pull to capture state
			const originalPull = engine.pull.bind(engine);
			engine.pull = async () => {
				stateWhileSyncing = engine.state;
				return originalPull();
			};

			await engine.sync();

			expect(stateWhileSyncing).toBe('syncing');
			expect(engine.state).toBe('idle');
		});

		it('should set state to error when errors occur', async () => {
			const mockFetch = createMockFetch(
				'Server Error',
				{ status: 500, ok: false }
			);

			const engine = new SyncEngine(storage, queue, metadata, mockFetch);
			await engine.sync();

			expect(engine.state).toBe('error');
			expect(engine.lastError).toBeTruthy();
		});

		it('should prevent concurrent sync calls', async () => {
			const mockFetch = vi.fn().mockImplementation(
				() => new Promise((resolve) => {
					setTimeout(() => resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve(emptyPullResponse),
						text: () => Promise.resolve('')
					}), 50);
				})
			) as unknown as typeof globalThis.fetch;

			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			// Start two syncs simultaneously
			const [firstResult, secondResult] = await Promise.all([
				engine.sync(),
				engine.sync()
			]);

			// One should succeed, the other should return "already in progress"
			const totalErrors = [...firstResult.errors, ...secondResult.errors];
			expect(totalErrors).toContain('Sync already in progress');
		});
	});

	describe('initialSync', () => {
		it('should pull all data without a since timestamp', async () => {
			const pullResponse: SyncPullResponse = {
				...emptyPullResponse,
				clients: [
					{
						id: 'c1',
						userId: 'u1',
						name: 'Existing Client',
						shortCode: 'EC',
						createdAt: '2026-01-01T00:00:00.000Z',
						updatedAt: '2026-01-01T00:00:00.000Z'
					}
				],
				serverTimestamp: '2026-02-08T12:00:00.000Z'
			};

			const mockFetch = createMockFetch(pullResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			await engine.initialSync();

			// Should have called fetch without ?since=
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/sync/pull',
				expect.any(Object)
			);

			// Data should be stored
			const localClients = await storage.getAll('clients');
			expect(localClients).toHaveLength(1);

			// State should be idle
			expect(engine.state).toBe('idle');
		});

		it('should set error state on failure', async () => {
			const mockFetch = createNetworkErrorFetch();
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			await engine.initialSync();

			expect(engine.state).toBe('offline');
			expect(engine.lastError).toBeTruthy();
		});
	});

	describe('refreshPendingCount', () => {
		it('should update pendingCount from queue', async () => {
			const mockFetch = createMockFetch(emptyPullResponse);
			const engine = new SyncEngine(storage, queue, metadata, mockFetch);

			expect(engine.pendingCount).toBe(0);

			await queue.enqueue({
				table: 'clients',
				entityId: 'client-1',
				operation: 'upsert',
				data: { id: 'client-1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			});

			await engine.refreshPendingCount();
			expect(engine.pendingCount).toBe(1);
		});
	});
});
