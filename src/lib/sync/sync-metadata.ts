/**
 * Sync Metadata — Persistent Sync State Tracking
 *
 * Stores key-value metadata about the sync state, most importantly
 * the timestamp of the last successful sync. This is persisted in the
 * local StorageAdapter's internal _syncMeta table so it survives
 * page reloads and app restarts.
 */

import type { StorageAdapter } from '../storage/types';

// ---------------------------------------------------------------------------
// Metadata keys
// ---------------------------------------------------------------------------

const LAST_SYNC_TIMESTAMP_KEY = 'lastSyncTimestamp';

// ---------------------------------------------------------------------------
// SyncMetadata
// ---------------------------------------------------------------------------

export class SyncMetadata {
	private storage: StorageAdapter;

	constructor(storage: StorageAdapter) {
		this.storage = storage;
	}

	/**
	 * Get the timestamp of the last successful sync.
	 * Returns null if no sync has ever completed.
	 */
	async getLastSyncTimestamp(): Promise<string | null> {
		return this.storage.getSyncMeta(LAST_SYNC_TIMESTAMP_KEY);
	}

	/**
	 * Record the timestamp of a successful sync.
	 *
	 * @param timestamp - ISO 8601 timestamp from the server.
	 */
	async setLastSyncTimestamp(timestamp: string): Promise<void> {
		await this.storage.setSyncMeta(LAST_SYNC_TIMESTAMP_KEY, timestamp);
	}
}
