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
		if (this.isOnline) {
			try {
				const response = await fetch('/api/contracts-by-client');
				if (!response.ok) throw new Error('Server error');
				const data = await response.json();
				return data.contracts;
			} catch {
				// Fall through to local
			}
		}
		return queryContractsByClient(this.storage);
	}

	// -- Notes (delegated) --

	async getNotesForContract(contractId: string): Promise<NoteSummary[]> {
		return fetchNotesForContract(this.storage, this.isOnline, contractId);
	}

	async getNoteById(noteId: string): Promise<NoteDetail | null> {
		return fetchNoteById(this.storage, this.isOnline, noteId);
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
		return fetchWeeklyTimeEntries(this.storage, this.isOnline, weekStarts);
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
		return fetchTimerStatus(this.storage, this.isOnline);
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
