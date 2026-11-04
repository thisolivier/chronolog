/**
 * The signed-in user's offline session (sprint 045-CL): opens the outbox and the long-lived read
 * cache, replays the outbox whenever the server may be reachable, and clears everything on
 * sign-out.
 *
 * Replays are triggered at start, by the browser's `online` event, shortly after a change is
 * queued, and every few seconds while items wait. One tab replays at a time (Web Locks).
 */
import { announceNotesChanged } from '$lib/services/notes-changed-event';
import { clearReadCache, hydrateReadCache, setReadCacheLoading, setReadCachePersistence } from '$lib/services/fetch-helpers';
import { outbox } from './outbox-store.svelte';
import { replayOutbox } from './outbox-replay';
import { classifyReplayError, replayTransport } from './replay-transport';
import { deleteAllReadCaches, openReadCache, type OpenedReadCache } from './read-cache-store';

/** Fired after a replay sent something: `{ notes: string[], entries: string[] }` (real IDs) */
export const OUTBOX_REPLAYED_EVENT = 'chronolog:outbox-replayed';
/** Fired when a note or entry made offline got its real ID: `{ tempId, realId, type }` */
export const OFFLINE_ID_REMAPPED_EVENT = 'chronolog:offline-id-remapped';
/** Service-worker caches holding signed-in pages (`src/service-worker.ts`) */
export const PAGE_CACHE_NAME = 'chronolog-pages';

const RETRY_INTERVAL_MS = 8000;
const REPLAY_LOCK_NAME = 'chronolog-outbox-replay';

let sessionUserId: string | null = null;
let readCache: OpenedReadCache | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let scheduledReplay: ReturnType<typeof setTimeout> | null = null;

/** note ID → the `updatedAt` values a replay superseded, and the server's value after it */
const updatedAtSubstitutions = new Map<string, { from: Set<string>; to: string }>();

/**
 * An editor based on a copy the outbox has since replayed may carry on from the replayed copy:
 * the replay sent this browser's own edits, so its old `expectedUpdatedAt` is not a conflict.
 */
export function substituteExpectedUpdatedAt(noteId: string, expected: string | undefined): string | undefined {
	if (!expected) return expected;
	const substitution = updatedAtSubstitutions.get(noteId);
	return substitution?.from.has(expected) ? substitution.to : expected;
}

function recordNoteUpdated(noteId: string, fromUpdatedAt: string[], toUpdatedAt: string): void {
	const existing = updatedAtSubstitutions.get(noteId);
	const from = new Set([...(existing?.from ?? []), ...(existing ? [existing.to] : []), ...fromUpdatedAt]);
	from.delete(toUpdatedAt);
	updatedAtSubstitutions.set(noteId, { from, to: toUpdatedAt });
}

function dispatch(name: string, detail: unknown): void {
	if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function runReplay(): Promise<void> {
	if (!outbox.isOpen || outbox.replaying) return;
	outbox.refresh();
	if (outbox.pendingCount === 0) return;
	outbox.replaying = true;
	const replayedNotes: string[] = [];
	const replayedEntries: string[] = [];
	try {
		const result = await replayOutbox(outbox, replayTransport, {
			classifyError: classifyReplayError,
			now: () => new Date().toISOString(),
			onRemapped: (tempId, realId, type) => dispatch(OFFLINE_ID_REMAPPED_EVENT, { tempId, realId, type }),
			onReplayed: (type, id) => {
				outbox.replayed.add(`${type}:${id}`);
				(type === 'note' ? replayedNotes : replayedEntries).push(id);
			},
			onNoteUpdated: recordNoteUpdated
		});
		if (result.replayed > 0 || result.held > 0) {
			dispatch(OUTBOX_REPLAYED_EVENT, { notes: replayedNotes, entries: replayedEntries });
			if (replayedNotes.length > 0) announceNotesChanged();
		}
	} catch (replayError) {
		console.error('[offline] outbox replay failed', replayError);
	} finally {
		outbox.replaying = false;
		outbox.refresh();
	}
}

/** Replay now, unless another tab is already doing it */
export async function replayNow(): Promise<void> {
	const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
	if (!locks) return runReplay();
	await locks.request(REPLAY_LOCK_NAME, { ifAvailable: true }, async (lock) => {
		if (lock) await runReplay();
	});
}

export function scheduleReplay(delayMs = 400): void {
	if (scheduledReplay) clearTimeout(scheduledReplay);
	scheduledReplay = setTimeout(() => {
		scheduledReplay = null;
		void replayNow();
	}, delayMs);
}

function handleStorage(event: StorageEvent): void {
	if (outbox.matchesStorageKey(event.key)) outbox.refresh();
}

function handleOnline(): void {
	scheduleReplay(300);
}

/**
 * Open the user's outbox and read cache. Call it as early as possible on page load: reads that
 * fail before the stored copies are loaded wait for them (`setReadCacheLoading`).
 */
export function startOfflineSession(userId: string): void {
	if (sessionUserId === userId || typeof window === 'undefined') return;
	sessionUserId = userId;
	outbox.open(userId);
	window.addEventListener('storage', handleStorage);
	window.addEventListener('online', handleOnline);
	retryTimer = setInterval(() => {
		if (outbox.pendingCount > 0) void replayNow();
	}, RETRY_INTERVAL_MS);
	const loading = openReadCache(userId)
		.then((opened) => {
			if (!opened || sessionUserId !== userId) return opened?.close();
			readCache = opened;
			hydrateReadCache(opened.entries);
			setReadCachePersistence(opened.persistence);
		})
		.catch((cacheError) => console.warn('[offline] read cache unavailable', cacheError))
		.finally(() => scheduleReplay(0));
	setReadCacheLoading(loading);
}

function stopOfflineSession(): void {
	sessionUserId = null;
	if (retryTimer) clearInterval(retryTimer);
	if (scheduledReplay) clearTimeout(scheduledReplay);
	retryTimer = scheduledReplay = null;
	window.removeEventListener('storage', handleStorage);
	window.removeEventListener('online', handleOnline);
	setReadCachePersistence(null);
	setReadCacheLoading(null);
	readCache?.close();
	readCache = null;
	outbox.close();
	updatedAtSubstitutions.clear();
}

/**
 * Before signing out: nothing cached outlives the session (every user's read cache and the kept
 * pages go). This user's queued changes that never reached the server are only discarded after
 * the user confirms; returns false when they chose to stay.
 */
export async function clearOfflineDataForSignOut(confirmDiscard: (count: number) => boolean): Promise<boolean> {
	const queuedCount = outbox.read().items.length;
	if (queuedCount > 0 && !confirmDiscard(queuedCount)) return false;
	// This user's queue only: another account's unsent changes in this browser are theirs to keep
	outbox.discardStored();
	stopOfflineSession();
	clearReadCache();
	await deleteAllReadCaches().catch(() => {});
	if (typeof caches !== 'undefined') await caches.delete(PAGE_CACHE_NAME).catch(() => false);
	return true;
}
