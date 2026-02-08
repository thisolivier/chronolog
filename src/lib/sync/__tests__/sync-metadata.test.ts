/**
 * Tests for SyncMetadata — Persistent Sync State Tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SyncMetadata } from '../sync-metadata';
import { MockStorageAdapter } from './mock-storage-adapter';

describe('SyncMetadata', () => {
	let storage: MockStorageAdapter;
	let metadata: SyncMetadata;

	beforeEach(async () => {
		storage = new MockStorageAdapter();
		await storage.init();
		metadata = new SyncMetadata(storage);
	});

	it('should return null when no sync timestamp has been set', async () => {
		const timestamp = await metadata.getLastSyncTimestamp();
		expect(timestamp).toBeNull();
	});

	it('should store and retrieve a sync timestamp', async () => {
		const testTimestamp = '2026-02-08T10:30:00.000Z';
		await metadata.setLastSyncTimestamp(testTimestamp);

		const retrieved = await metadata.getLastSyncTimestamp();
		expect(retrieved).toBe(testTimestamp);
	});

	it('should overwrite the previous timestamp', async () => {
		await metadata.setLastSyncTimestamp('2026-02-08T10:00:00.000Z');
		await metadata.setLastSyncTimestamp('2026-02-08T12:00:00.000Z');

		const retrieved = await metadata.getLastSyncTimestamp();
		expect(retrieved).toBe('2026-02-08T12:00:00.000Z');
	});

	it('should persist across separate SyncMetadata instances', async () => {
		await metadata.setLastSyncTimestamp('2026-02-08T10:00:00.000Z');

		// Create a new SyncMetadata instance with the same storage
		const secondInstance = new SyncMetadata(storage);
		const retrieved = await secondInstance.getLastSyncTimestamp();
		expect(retrieved).toBe('2026-02-08T10:00:00.000Z');
	});
});
