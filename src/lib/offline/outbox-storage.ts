/**
 * Persisting the outbox (sprint 045-CL). localStorage, not IndexedDB: writes are synchronous, so
 * an edit queued just before the tab closes is already on disk.
 *
 * One key per item (`chronolog-outbox:<userId>:item:<sequence>`) and per remapped ID
 * (`…:id:<tempId>`). A change writes only the keys it changed and removes only the items it
 * removed, so two tabs queueing at once never overwrite each other's items (review fix 4: a
 * single JSON value, read-modify-written by two tabs, lost one tab's edits). Web Locks were not
 * used for this: they are asynchronous, and a save queued during `pagehide` would not reach the
 * disk before the page is gone.
 */
import type { OutboxItem, OutboxState } from './outbox-types';

export const OUTBOX_KEY_PREFIX = 'chronolog-outbox:';
/** Where an item that could not be read is kept aside (never deleted) */
export const UNREADABLE_KEY_PREFIX = 'chronolog-outbox-unreadable:';

/** Thrown when a change could not be stored on this device (storage full) */
export class OutboxFullError extends Error {
	constructor(message = 'This change could not be kept on this device (browser storage is full). Copy your text somewhere safe.') {
		super(message);
		this.name = 'OutboxFullError';
	}
}

export function outboxKeyPrefix(userId: string): string {
	return `${OUTBOX_KEY_PREFIX}${userId}:`;
}

function itemKey(prefix: string, sequence: number): string {
	return `${prefix}item:${sequence}`;
}

function isOutboxItem(value: unknown): value is OutboxItem {
	const candidate = value as Partial<OutboxItem> | null;
	return Boolean(candidate) && typeof candidate?.sequence === 'number' && typeof candidate?.kind === 'string';
}

function keysStartingWith(storage: Storage, prefix: string): string[] {
	const keys: string[] = [];
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index);
		if (key?.startsWith(prefix)) keys.push(key);
	}
	return keys;
}

/** A sequence after every stored one, unique enough across tabs (time-based, with a random tail) */
export function nextSequenceAfter(items: OutboxItem[], now = Date.now()): number {
	const highest = items.reduce((max, item) => Math.max(max, item.sequence), 0);
	return Math.max(highest + 1, now * 1000 + Math.floor(Math.random() * 1000));
}

/**
 * The stored queue, in order. An item that cannot be read is moved to an `unreadable` key, never
 * dropped; if even that copy does not fit, this throws `OutboxFullError` and nothing is changed,
 * so no later write can replace it.
 */
export function loadOutboxState(storage: Storage, prefix: string): OutboxState {
	const items: OutboxItem[] = [];
	const idMap: Record<string, string> = {};
	for (const key of keysStartingWith(storage, prefix)) {
		const raw = storage.getItem(key);
		if (raw === null) continue;
		const rest = key.slice(prefix.length);
		if (rest.startsWith('id:')) {
			idMap[rest.slice(3)] = raw;
			continue;
		}
		let parsed: unknown = null;
		try {
			parsed = JSON.parse(raw);
		} catch {
			// handled below
		}
		if (isOutboxItem(parsed)) {
			items.push(parsed);
			continue;
		}
		try {
			storage.setItem(`${UNREADABLE_KEY_PREFIX}${key}:${Date.now()}`, raw);
		} catch {
			throw new OutboxFullError('Part of the offline queue could not be read or set aside (browser storage is full); nothing was changed.');
		}
		storage.removeItem(key);
	}
	items.sort((first, second) => first.sequence - second.sequence);
	return { items, nextSequence: nextSequenceAfter(items), idMap };
}

/**
 * Write what changed between `before` (as read) and `after`: changed and new items, removed
 * items, new ID mappings. Items another tab added meanwhile are not in `before`, so they stay.
 * Throws `OutboxFullError` when storage is full.
 */
export function applyOutboxChange(storage: Storage, prefix: string, before: OutboxState, after: OutboxState): void {
	const beforeById = new Map(before.items.map((item) => [item.sequence, JSON.stringify(item)]));
	const afterSequences = new Set(after.items.map((item) => item.sequence));
	try {
		for (const item of after.items) {
			const serialised = JSON.stringify(item);
			if (beforeById.get(item.sequence) !== serialised) storage.setItem(itemKey(prefix, item.sequence), serialised);
		}
		for (const [tempId, realId] of Object.entries(after.idMap)) {
			if (before.idMap[tempId] !== realId) storage.setItem(`${prefix}id:${tempId}`, realId);
		}
	} catch {
		throw new OutboxFullError();
	}
	const beforeRevisions = new Map(before.items.map((item) => [item.sequence, item.revision]));
	for (const sequence of beforeById.keys()) {
		if (afterSequences.has(sequence)) continue;
		// Another tab changed it since it was read (a new revision): it is newer work, keep it
		if (storedRevision(storage, itemKey(prefix, sequence)) !== beforeRevisions.get(sequence)) continue;
		storage.removeItem(itemKey(prefix, sequence));
	}
}

function storedRevision(storage: Storage, key: string): number | null {
	try {
		const stored = JSON.parse(storage.getItem(key) ?? 'null') as { revision?: number } | null;
		return stored?.revision ?? null;
	} catch {
		return null;
	}
}

/** Remove one user's whole queue and ID map (sign-out) */
export function removeStoredOutbox(storage: Storage, prefix: string): void {
	for (const key of keysStartingWith(storage, prefix)) storage.removeItem(key);
}

/** A Storage kept in memory: tests, and browsers that refuse localStorage (private mode) */
export class MemoryStorage implements Storage {
	private values = new Map<string, string>();
	/** Tests: make the next writes fail as a full storage would */
	failWrites = false;
	get length(): number {
		return this.values.size;
	}
	clear(): void {
		this.values.clear();
	}
	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}
	key(index: number): string | null {
		return [...this.values.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.values.delete(key);
	}
	setItem(key: string, value: string): void {
		if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
		this.values.set(key, String(value));
	}
}
