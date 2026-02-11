/**
 * Synced Data Service — Main Data Layer Bridge
 *
 * The primary interface between UI components and the storage+sync layer.
 * Provides reactive sync state and offline-capable data access methods.
 *
 * Data access methods are split into separate files by domain:
 * - service-notes.ts — notes CRUD
 * - service-time-entries.ts — time entries, weekly statuses
 * - service-timer.ts — timer operations
 */

import { getStorage, type StorageAdapter } from '$lib/storage';
import { SyncEngine } from './sync-engine.svelte';
import { SyncQueue } from './sync-queue';
import { SyncMetadata } from './sync-metadata';
import { createOnlineStatus, type OnlineStatus } from './online-status.svelte';
import type { ContractRow, ClientRow } from '$lib/storage/types';
import type { SyncState, SyncResult } from './types';
import type {
	ContractsByClientResult,
	NoteSummary,
	NoteDetail,
	NoteUpdateData,
	WeekData,
	TimeEntryCreateData,
	TimeEntryUpdateData,
	TimerEntry,
	TimerSaveData
} from './data-types';
import { queryContractsByClient } from './local-queries';
import {
	fetchNotesForContract,
	fetchNoteById,
	createNoteAction,
	updateNoteAction,
	deleteNoteAction
} from './service-notes';
import {
	fetchWeeklyTimeEntries,
	createTimeEntryAction,
	updateTimeEntryAction,
	deleteTimeEntryAction,
	updateWeeklyStatusAction
} from './service-time-entries';
import {
	fetchTimerStatus,
	startTimerAction,
	stopTimerAction,
	saveTimerAction,
	discardTimerAction,
	updateDraftAction
} from './service-timer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_INTERVAL_MS = 30_000; // 30 seconds
const MUTATION_DEBOUNCE_MS = 2_000; // debounce sync after mutations

// ---------------------------------------------------------------------------
// SyncedDataService
// ---------------------------------------------------------------------------

export class SyncedDataService {
	private storage!: StorageAdapter;
	private engine!: SyncEngine;
	private queue!: SyncQueue;
	private metadata!: SyncMetadata;
	private onlineStatus!: OnlineStatus;
	private syncIntervalId: ReturnType<typeof setInterval> | null = null;
	private mutationDebounceId: ReturnType<typeof setTimeout> | null = null;
	private initialized = false;

	// Bound enqueue function for passing to extracted service methods
	private boundEnqueue = this.enqueueMutation.bind(this);

	// -- Reactive state exposed to components --

	get isOnline(): boolean {
		return this.onlineStatus?.isOnline ?? true;
	}

	get syncState(): SyncState {
		return this.engine?.state ?? 'idle';
	}

	get pendingCount(): number {
		return this.engine?.pendingCount ?? 0;
	}

	get authExpired(): boolean {
		return this.engine?.authExpired ?? false;
	}

	/**
	 * Whether it's safe to read from server APIs.
	 * When there are pending mutations, local storage has data the server doesn't
	 * know about yet — so reads should use local storage to avoid hiding unsynced items.
	 */
	private get isServerSynced(): boolean {
		return this.isOnline && this.pendingCount === 0 && this.syncState !== 'error';
	}

	// -- Lifecycle --

	async initialize(): Promise<void> {
		if (this.initialized) return;

		this.storage = await getStorage();
		this.queue = new SyncQueue(this.storage);
		this.metadata = new SyncMetadata(this.storage);
		this.engine = new SyncEngine(this.storage, this.queue, this.metadata);
		this.onlineStatus = createOnlineStatus();

		const lastSync = await this.metadata.getLastSyncTimestamp();
		if (!lastSync) {
			await this.engine.initialSync();
		} else {
			this.engine.sync().catch(() => {});
		}

		this.startPeriodicSync();
		this.initialized = true;
	}

	destroy(): void {
		this.stopPeriodicSync();
		if (this.mutationDebounceId) {
			clearTimeout(this.mutationDebounceId);
		}
		this.onlineStatus?.destroy();
	}

	async sync(): Promise<SyncResult> {
		return this.engine.sync();
	}

	// -- Contracts sidebar --

	async getContractsByClient(): Promise<ContractsByClientResult[]> {
		if (this.isServerSynced) {
			try {
				const response = await fetch('/api/contracts-by-client');
				if (!response.ok) throw new Error('Server error');
				const data = await response.json();

				// Cache contracts and clients locally so offline operations
				// (like note ID generation) can find them even if sync hasn't pulled yet
				await this.cacheContractData(data.contracts);

				return data.contracts;
			} catch {
				// Fall through to local
			}
		}
		return queryContractsByClient(this.storage);
	}

	/**
	 * Cache contract and client data from the API response into local storage.
	 * Uses bulkPut to upsert without destroying existing data.
	 */
	private async cacheContractData(
		contracts: ContractsByClientResult[]
	): Promise<void> {
		try {
			// Dedupe clients by ID
			const clientMap = new Map<string, ClientRow>();
			const contractRows: ContractRow[] = [];

			const now = new Date().toISOString();

			for (const contract of contracts) {
				if (!clientMap.has(contract.clientId)) {
					// Check if client already exists in local storage to preserve timestamps
					const existingClient = await this.storage.getById('clients', contract.clientId);
					clientMap.set(contract.clientId, {
						id: contract.clientId,
						userId: existingClient?.userId ?? '',
						name: contract.clientName,
						shortCode: contract.clientShortCode,
						createdAt: existingClient?.createdAt ?? now,
						updatedAt: existingClient?.updatedAt ?? now
					});
				}

				const existingContract = await this.storage.getById('contracts', contract.id);
				contractRows.push({
					id: contract.id,
					clientId: contract.clientId,
					name: contract.name,
					description: existingContract?.description ?? null,
					isActive: contract.isActive,
					sortOrder: contract.sortOrder,
					createdAt: existingContract?.createdAt ?? now,
					updatedAt: existingContract?.updatedAt ?? now
				});
			}

			if (clientMap.size > 0) {
				await this.storage.bulkPut('clients', [...clientMap.values()]);
			}
			if (contractRows.length > 0) {
				await this.storage.bulkPut('contracts', contractRows);
			}
		} catch {
			// Caching failure shouldn't break the UI
		}
	}

	// -- Notes (delegated) --

	async getNotesForContract(contractId: string): Promise<NoteSummary[]> {
		return fetchNotesForContract(this.storage, this.isServerSynced, contractId);
	}

	async getNoteById(noteId: string): Promise<NoteDetail | null> {
		return fetchNoteById(this.storage, this.isServerSynced, noteId);
	}

	async createNote(contractId: string): Promise<{ note: NoteDetail }> {
		return createNoteAction(this.storage, this.isOnline, contractId, this.boundEnqueue);
	}

	async updateNote(noteId: string, data: NoteUpdateData): Promise<NoteDetail | null> {
		return updateNoteAction(this.storage, this.isOnline, noteId, data, this.boundEnqueue);
	}

	async deleteNote(noteId: string): Promise<void> {
		return deleteNoteAction(this.storage, this.isOnline, noteId, this.boundEnqueue);
	}

	// -- Time entries (delegated) --

	async getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]> {
		return fetchWeeklyTimeEntries(this.storage, this.isServerSynced, weekStarts);
	}

	async createTimeEntry(data: TimeEntryCreateData): Promise<{ id: string }> {
		return createTimeEntryAction(this.storage, this.isOnline, data, this.boundEnqueue);
	}

	async updateTimeEntry(entryId: string, data: TimeEntryUpdateData): Promise<void> {
		return updateTimeEntryAction(this.storage, this.isOnline, entryId, data, this.boundEnqueue);
	}

	async deleteTimeEntry(entryId: string): Promise<void> {
		return deleteTimeEntryAction(this.storage, this.isOnline, entryId, this.boundEnqueue);
	}

	async updateWeeklyStatus(year: number, weekNumber: number, status: string): Promise<void> {
		return updateWeeklyStatusAction(
			this.storage, this.isOnline, year, weekNumber, status, this.boundEnqueue
		);
	}

	// -- Timer (delegated) --

	async getTimerStatus(): Promise<{ timer: TimerEntry | null }> {
		return fetchTimerStatus(this.storage, this.isServerSynced);
	}

	async startTimer(contractId?: string): Promise<TimerEntry> {
		return startTimerAction(this.storage, this.isOnline, contractId);
	}

	async stopTimer(entryId: string): Promise<TimerEntry> {
		return stopTimerAction(this.storage, this.isOnline, entryId);
	}

	async saveTimer(entryId: string, data: TimerSaveData): Promise<void> {
		return saveTimerAction(this.storage, this.isOnline, entryId, data, this.boundEnqueue);
	}

	async discardTimer(entryId: string): Promise<void> {
		return discardTimerAction(this.storage, this.isOnline, entryId);
	}

	async updateDraft(
		entryId: string,
		data: { contractId?: string; description?: string }
	): Promise<void> {
		return updateDraftAction(this.storage, this.isOnline, entryId, data);
	}

	// -- Internal helpers --

	private async enqueueMutation(
		table: string,
		entityId: string,
		operation: 'upsert' | 'delete',
		data: Record<string, unknown>
	): Promise<void> {
		await this.queue.enqueue({
			table,
			entityId,
			operation,
			data,
			timestamp: new Date().toISOString()
		});
		await this.engine.refreshPendingCount();
		this.debouncedSync();
	}

	private debouncedSync(): void {
		if (this.mutationDebounceId) {
			clearTimeout(this.mutationDebounceId);
		}
		this.mutationDebounceId = setTimeout(() => {
			if (this.isOnline) {
				this.engine.sync().catch(() => {});
			}
		}, MUTATION_DEBOUNCE_MS);
	}

	private startPeriodicSync(): void {
		this.syncIntervalId = setInterval(() => {
			if (this.isOnline && this.engine.state !== 'syncing') {
				this.engine.sync().catch(() => {});
			}
		}, SYNC_INTERVAL_MS);
	}

	private stopPeriodicSync(): void {
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}
	}
}
