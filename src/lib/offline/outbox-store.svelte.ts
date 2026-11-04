/**
 * The signed-in user's outbox as reactive state (sprint 045-CL). Every read and change goes
 * through localStorage first (`outbox-storage.ts`), so another tab's changes are seen and a
 * change is on disk before the call returns.
 */
import { SvelteSet } from 'svelte/reactivity';
import { loadOutboxState, MemoryStorage, outboxStorageKey, saveOutboxState } from './outbox-storage';
import type { OutboxItem, OutboxState } from './outbox-types';
import { emptyOutboxState, itemResourceKey } from './outbox-types';

/** Thrown when a change could not be stored on this device (storage full) */
export class OutboxFullError extends Error {
	constructor() {
		super('This change could not be kept on this device (browser storage is full). Copy your text somewhere safe.');
		this.name = 'OutboxFullError';
	}
}

function browserStorage(): Storage {
	try {
		if (typeof localStorage !== 'undefined') return localStorage;
	} catch {
		// Storage refused (private mode): the queue lives for this page only
	}
	return new MemoryStorage();
}

class OutboxStore {
	/** Items in queue order; reassigned on every change */
	items = $state.raw<OutboxItem[]>([]);
	/** True while a replay is running in this tab */
	replaying = $state(false);
	/** Resources (`note:<id>`, `entry:<id>`) replayed this session, for the "replayed" marker */
	readonly replayed = new SvelteSet<string>();

	private storageKey: string | null = null;
	private storage: Storage = new MemoryStorage();

	get isOpen(): boolean {
		return this.storageKey !== null;
	}

	get pendingCount(): number {
		return this.items.filter((item) => item.status === 'pending').length;
	}

	get heldItems(): OutboxItem[] {
		return this.items.filter((item) => item.status === 'held');
	}

	open(userId: string, storage: Storage = browserStorage()): void {
		this.storage = storage;
		this.storageKey = outboxStorageKey(userId);
		this.refresh();
	}

	close(): void {
		this.storageKey = null;
		this.items = [];
		this.replayed.clear();
	}

	/** Sign-out: forget this user's queue and ID map */
	discardStored(): void {
		if (this.storageKey) this.storage.removeItem(this.storageKey);
		this.items = [];
	}

	/** A fresh copy of the stored queue */
	read(): OutboxState {
		if (!this.storageKey) return emptyOutboxState();
		return loadOutboxState(this.storage, this.storageKey);
	}

	/** Read, change and store in one step; throws `OutboxFullError` when it does not fit */
	update(mutate: (state: OutboxState) => void): void {
		if (!this.storageKey) throw new Error('No signed-in user for the offline outbox');
		const state = this.read();
		mutate(state);
		try {
			saveOutboxState(this.storage, this.storageKey, state);
		} catch {
			throw new OutboxFullError();
		}
		this.items = state.items;
	}

	/** Re-read after another tab changed the queue (`storage` event) */
	refresh(): void {
		this.items = this.read().items;
	}

	matchesStorageKey(key: string | null): boolean {
		return key === null || key === this.storageKey;
	}

	/** Read from storage, not `items`: another tab may have queued it */
	hasItemFor(resourceKey: string): boolean {
		return this.read().items.some((item) => itemResourceKey(item) === resourceKey);
	}

	/** What a note or entry row shows: waiting, held, or sent this session (reactive) */
	statusOf(resourceKey: string): 'queued' | 'held' | 'replayed' | null {
		const item = this.items.find((candidate) => itemResourceKey(candidate) === resourceKey);
		if (item) return item.status === 'held' ? 'held' : 'queued';
		return this.replayed.has(resourceKey) ? 'replayed' : null;
	}

	idMap(): Record<string, string> {
		return this.read().idMap;
	}
}

export const outbox = new OutboxStore();
