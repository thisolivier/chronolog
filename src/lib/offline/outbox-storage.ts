/**
 * Persisting the outbox (sprint 045-CL). localStorage, not IndexedDB: writes are synchronous, so
 * an edit queued just before the tab closes is already on disk, and every read-modify-write is
 * atomic within the tab. The queue is small (one item per edited note or entry).
 */
import { emptyOutboxState, type OutboxState } from './outbox-types';

export const OUTBOX_KEY_PREFIX = 'chronolog-outbox:';

export function outboxStorageKey(userId: string): string {
	return `${OUTBOX_KEY_PREFIX}${userId}`;
}

function isOutboxState(value: unknown): value is OutboxState {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<OutboxState>;
	return Array.isArray(candidate.items) && typeof candidate.nextSequence === 'number' && typeof candidate.idMap === 'object';
}

/**
 * The stored queue, or an empty one. Unreadable data is never thrown away: it is copied to a
 * `…:unreadable:<time>` key before the queue starts empty.
 */
export function loadOutboxState(storage: Storage, key: string): OutboxState {
	const raw = storage.getItem(key);
	if (!raw) return emptyOutboxState();
	try {
		const parsed: unknown = JSON.parse(raw);
		if (isOutboxState(parsed)) return parsed;
	} catch {
		// fall through
	}
	try {
		storage.setItem(`${key}:unreadable:${Date.now()}`, raw);
	} catch {
		// Keep the original where it is if the copy does not fit
		return emptyOutboxState();
	}
	storage.removeItem(key);
	return emptyOutboxState();
}

/** Throws when storage is full, so the caller can report that the change was not kept */
export function saveOutboxState(storage: Storage, key: string, state: OutboxState): void {
	if (state.items.length === 0 && Object.keys(state.idMap).length === 0) {
		storage.removeItem(key);
		return;
	}
	storage.setItem(key, JSON.stringify(state));
}

/** A Storage kept in memory: tests, and browsers that refuse localStorage (private mode) */
export class MemoryStorage implements Storage {
	private values = new Map<string, string>();
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
		this.values.set(key, String(value));
	}
}
