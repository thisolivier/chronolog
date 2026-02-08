/**
 * Sync Engine — Main Orchestrator
 *
 * Coordinates the full sync cycle: pushing local mutations to the
 * server, then pulling remote changes into local storage. Exposes
 * reactive state (via Svelte 5 `$state`) so the UI can display
 * sync progress and pending mutation counts.
 *
 * The engine is platform-agnostic — it works on both Tauri desktop
 * and PWA/browser environments, using the injected StorageAdapter
 * and standard Fetch API.
 */

import type { StorageAdapter, TableName } from '../storage/types';
import type { SyncQueue } from './sync-queue';
import type { SyncMetadata } from './sync-metadata';
import type {
	SyncState,
	SyncResult,
	PullResult,
	PushResult,
	SyncPullResponse,
	SyncTableName,
	SYNC_TABLE_NAMES
} from './types';
import {
	pullFromServer,
	pushToServer,
	SyncAuthError,
	SyncNetworkError,
	type FetchFunction
} from './sync-fetcher';

// ---------------------------------------------------------------------------
// SyncEngine
// ---------------------------------------------------------------------------

export class SyncEngine {
	private storage: StorageAdapter;
	private queue: SyncQueue;
	private metadata: SyncMetadata;
	private fetchFn: FetchFunction;

	/** Current sync state — reactive via Svelte 5 $state. */
	state = $state<SyncState>('idle');

	/** Number of mutations waiting to be pushed. */
	pendingCount = $state(0);

	/** Last error message, or null if no error. */
	lastError = $state<string | null>(null);

	/** Whether the auth session has expired (401 from server). */
	authExpired = $state(false);

	constructor(
		storage: StorageAdapter,
		queue: SyncQueue,
		metadata: SyncMetadata,
		fetchFn: FetchFunction = globalThis.fetch
	) {
		this.storage = storage;
		this.queue = queue;
		this.metadata = metadata;
		this.fetchFn = fetchFn;
	}

	/**
	 * Pull changes from the server since the last sync timestamp.
	 * Writes received data into local storage and updates the
	 * sync timestamp on success.
	 */
	async pull(): Promise<PullResult> {
		const errors: string[] = [];
		let pulled = 0;

		try {
			const sinceTimestamp = await this.metadata.getLastSyncTimestamp();
			const pullResponse = await pullFromServer(sinceTimestamp, this.fetchFn);

			pulled = await this.applyPullResponse(pullResponse);
			await this.metadata.setLastSyncTimestamp(pullResponse.serverTimestamp);
		} catch (error) {
			const errorMessage = this.handleSyncError(error);
			errors.push(errorMessage);
		}

		return { pulled, errors };
	}

	/**
	 * Push all queued mutations to the server.
	 * On success, clears the pushed mutations from the queue.
	 * On network error, mutations remain in the queue for retry.
	 */
	async push(): Promise<PushResult> {
		const errors: string[] = [];
		let pushed = 0;
		let conflicts = 0;

		try {
			const pendingMutations = await this.queue.getAll();

			if (pendingMutations.length === 0) {
				return { pushed: 0, conflicts: 0, errors: [] };
			}

			const pushResponse = await pushToServer(pendingMutations, this.fetchFn);
			pushed = pushResponse.applied;
			conflicts = pushResponse.conflicts;

			// Clear all pushed mutations on success
			await this.queue.clear();
		} catch (error) {
			const errorMessage = this.handleSyncError(error);
			errors.push(errorMessage);
		}

		await this.refreshPendingCount();
		return { pushed, conflicts, errors };
	}

	/**
	 * Run a full sync cycle: push local changes first, then pull
	 * server changes. Skips if currently syncing.
	 */
	async sync(): Promise<SyncResult> {
		if (this.state === 'syncing') {
			return { pulled: 0, pushed: 0, conflicts: 0, errors: ['Sync already in progress'] };
		}

		this.state = 'syncing';
		this.lastError = null;
		const allErrors: string[] = [];

		try {
			// Push first — send local changes to server
			const pushResult = await this.push();
			allErrors.push(...pushResult.errors);

			// Then pull — get server changes
			const pullResult = await this.pull();
			allErrors.push(...pullResult.errors);

			if (allErrors.length > 0) {
				this.state = 'error';
				this.lastError = allErrors[0];
			} else {
				this.state = 'idle';
			}

			return {
				pulled: pullResult.pulled,
				pushed: pushResult.pushed,
				conflicts: pushResult.conflicts,
				errors: allErrors
			};
		} catch (unexpectedError) {
			const errorMessage = unexpectedError instanceof Error
				? unexpectedError.message
				: 'Unexpected sync error';
			this.state = 'error';
			this.lastError = errorMessage;

			return { pulled: 0, pushed: 0, conflicts: 0, errors: [errorMessage] };
		}
	}

	/**
	 * Perform an initial sync — pull all data from the server
	 * without pushing anything first. Used on first app launch.
	 */
	async initialSync(): Promise<void> {
		this.state = 'syncing';
		this.lastError = null;

		try {
			const pullResponse = await pullFromServer(null, this.fetchFn);
			await this.applyPullResponse(pullResponse);
			await this.metadata.setLastSyncTimestamp(pullResponse.serverTimestamp);
			this.state = 'idle';
		} catch (error) {
			const errorMessage = this.handleSyncError(error);
			this.lastError = errorMessage;
			// handleSyncError may have already set state (e.g. 'offline')
			// Only override to 'error' if it wasn't already set to something specific
			if (this.state === 'syncing') {
				this.state = 'error';
			}
		}
	}

	/**
	 * Refresh the pending mutation count from the queue.
	 * Called after push operations and can be called externally
	 * to update the UI after enqueuing mutations.
	 */
	async refreshPendingCount(): Promise<void> {
		this.pendingCount = await this.queue.count();
	}

	// -----------------------------------------------------------------------
	// Private helpers
	// -----------------------------------------------------------------------

	/**
	 * Apply a pull response by writing each table's rows into local storage.
	 * Returns the total number of rows written.
	 */
	private async applyPullResponse(
		pullResponse: SyncPullResponse
	): Promise<number> {
		let totalRowsWritten = 0;

		const tableNames: SyncTableName[] = [
			'clients', 'contracts', 'deliverables', 'workTypes',
			'timeEntries', 'notes', 'noteLinks', 'noteTimeEntries',
			'weeklyStatuses', 'attachments'
		];

		for (const tableName of tableNames) {
			const rows = pullResponse[tableName];
			if (rows && rows.length > 0) {
				// Cast is safe: SyncTableName is a subset of TableName
				await this.storage.bulkPut(tableName as TableName, rows as never[]);
				totalRowsWritten += rows.length;
			}
		}

		return totalRowsWritten;
	}

	/**
	 * Handle a sync error by categorizing it and returning
	 * a user-friendly error message.
	 */
	private handleSyncError(error: unknown): string {
		if (error instanceof SyncAuthError) {
			this.authExpired = true;
			return 'Session expired — please log in again.';
		}

		if (error instanceof SyncNetworkError) {
			this.state = 'offline';
			return 'Network unavailable — changes saved locally.';
		}

		if (error instanceof Error) {
			return error.message;
		}

		return 'Unknown sync error';
	}
}
