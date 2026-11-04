/**
 * The signed-in user's outbox as reactive state (sprint 045-CL). Every read and change goes
 * through localStorage first (`outbox-storage.ts`), so another tab's changes are seen and a
 * change is on disk before the call returns.
 */
import { SvelteSet } from 'svelte/reactivity';
import { applyOutboxChange, loadOutboxState, MemoryStorage, outboxKeyPrefix, OutboxFullError, removeStoredOutbox } from './outbox-storage';
import type { OutboxItem, OutboxState } from './outbox-types';
import { emptyOutboxState, itemResourceKey } from './outbox-types';

export { OutboxFullError };

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
	/** Set when the server says another account is signed in: the queue is not sent (review fix 5b) */
	otherAccountSignedIn = $state(false);
	/** Resources (`note:<id>`, `entry:<id>`) replayed this session, for the "replayed" marker */
	readonly replayed = new SvelteSet<string>();

	private keyPrefix: string | null = null;
	/** The user this queue belongs to; every item is tagged with it */
	ownerUserId: string | null = null;
	private storage: Storage = new MemoryStorage();

	get isOpen(): boolean {
		return this.keyPrefix !== null;
	}

	get pendingCount(): number {
		return this.items.filter((item) => item.status === 'pending').length;
	}

	get heldItems(): OutboxItem[] {
		return this.items.filter((item) => item.status === 'held');
	}

	open(userId: string, storage: Storage = browserStorage()): void {
		this.storage = storage;
		this.ownerUserId = userId;
		this.keyPrefix = outboxKeyPrefix(userId);
		this.otherAccountSignedIn = false;
		this.refresh();
	}

	close(): void {
		this.keyPrefix = null;
		this.ownerUserId = null;
		this.items = [];
		this.otherAccountSignedIn = false;
		this.replayed.clear();
	}

	/** Sign-out: forget this user's queue and ID map */
	discardStored(): void {
		if (this.keyPrefix) removeStoredOutbox(this.storage, this.keyPrefix);
		this.items = [];
	}

	/** A fresh copy of the stored queue (throws `OutboxFullError` if part of it cannot be read) */
	read(): OutboxState {
		if (!this.keyPrefix) return emptyOutboxState();
		const state = loadOutboxState(this.storage, this.keyPrefix);
		state.ownerUserId = this.ownerUserId ?? undefined;
		return state;
	}

	/**
	 * Read, change and store in one synchronous step; only what changed is written, so another
	 * tab's items survive. Throws `OutboxFullError` when it does not fit.
	 */
	update(mutate: (state: OutboxState) => void): void {
		if (!this.keyPrefix) throw new Error('No signed-in user for the offline outbox');
		const before = this.read();
		const after = structuredClone(before);
		mutate(after);
		applyOutboxChange(this.storage, this.keyPrefix, before, after);
		this.items = this.read().items;
	}

	/** Re-read after another tab changed the queue (`storage` event) */
	refresh(): void {
		try {
			this.items = this.read().items;
		} catch (readError) {
			console.error('[offline] outbox unreadable', readError);
		}
	}

	matchesStorageKey(key: string | null): boolean {
		return key === null || (this.keyPrefix !== null && key.startsWith(this.keyPrefix));
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
