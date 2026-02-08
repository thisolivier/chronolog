/**
 * Sync Queue — Pending Mutation Storage
 *
 * Manages a queue of mutations that have been made locally but not yet
 * pushed to the server. Each mutation represents an upsert or delete
 * against a specific table and entity. Mutations are stored in the
 * local StorageAdapter's internal _syncQueue table and replayed
 * during the push phase of a sync cycle.
 */

import type { StorageAdapter } from '../storage/types';
import type { PendingMutation } from './types';

// ---------------------------------------------------------------------------
// SyncQueue
// ---------------------------------------------------------------------------

export class SyncQueue {
	private storage: StorageAdapter;

	constructor(storage: StorageAdapter) {
		this.storage = storage;
	}

	/**
	 * Add a mutation to the queue. A unique ID is generated automatically.
	 *
	 * @param mutation - The mutation to enqueue (without an ID).
	 */
	async enqueue(mutation: Omit<PendingMutation, 'id'>): Promise<void> {
		const mutationWithId: PendingMutation = {
			id: crypto.randomUUID(),
			...mutation
		};

		await this.storage.putSyncQueueItem(mutationWithId);
	}

	/**
	 * Retrieve all pending mutations, ordered by timestamp (oldest first).
	 */
	async getAll(): Promise<PendingMutation[]> {
		return this.storage.getAllSyncQueueItems();
	}

	/**
	 * Remove a single mutation from the queue after it has been
	 * successfully pushed to the server.
	 *
	 * @param mutationId - The unique ID of the mutation to remove.
	 */
	async dequeue(mutationId: string): Promise<void> {
		await this.storage.deleteSyncQueueItem(mutationId);
	}

	/**
	 * Remove all mutations from the queue.
	 * Typically called after a successful bulk push.
	 */
	async clear(): Promise<void> {
		await this.storage.clearSyncQueue();
	}

	/**
	 * Get the number of pending mutations in the queue.
	 */
	async count(): Promise<number> {
		const allItems = await this.storage.getAllSyncQueueItems();
		return allItems.length;
	}
}
