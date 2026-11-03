import { SvelteMap } from 'svelte/reactivity';

/**
 * Client-side cache of note display titles, used wherever a `[[id]]` wiki-link is
 * rendered (editor chips, time-entry cards, "Linked from", linked time entries).
 *
 * Lookups are batched into one `GET /api/notes/titles?ids=` request per tick. The map is
 * a `SvelteMap`, so Svelte templates re-render when a title arrives; non-Svelte code (the
 * TipTap node view) uses `subscribeToNoteTitles`.
 */

export type CachedNoteTitle = {
	displayTitle: string | null;
	contractId: string;
	clientId: string;
};

/** `null` = looked up and not found (deleted, or not the user's note) */
const titleCache = new SvelteMap<string, CachedNoteTitle | null>();
const requestedIds = new Set<string>();
const queuedIds = new Set<string>();
const listeners = new Set<() => void>();
let flushScheduled = false;

function notifyListeners(): void {
	for (const listener of listeners) listener();
}

async function flushQueue(): Promise<void> {
	flushScheduled = false;
	const noteIds = [...queuedIds];
	queuedIds.clear();
	if (noteIds.length === 0) return;

	try {
		const response = await fetch(`/api/notes/titles?ids=${encodeURIComponent(noteIds.join(','))}`);
		if (!response.ok) throw new Error(`titles request failed (${response.status})`);
		const data = (await response.json()) as {
			titles: Array<{ id: string } & CachedNoteTitle>;
		};
		const found = new Set<string>();
		for (const { id, displayTitle, contractId, clientId } of data.titles) {
			titleCache.set(id, { displayTitle, contractId, clientId });
			found.add(id);
		}
		for (const noteId of noteIds) {
			if (!found.has(noteId)) titleCache.set(noteId, null);
		}
		notifyListeners();
	} catch (error) {
		// Allow a later render to retry
		for (const noteId of noteIds) requestedIds.delete(noteId);
		console.error('Failed to load note titles:', error);
	}
}

/** Queue a lookup for any IDs not yet cached or in flight. */
export function requestNoteTitles(noteIds: Iterable<string>): void {
	for (const noteId of noteIds) {
		if (!noteId || requestedIds.has(noteId)) continue;
		requestedIds.add(noteId);
		queuedIds.add(noteId);
	}
	if (queuedIds.size > 0 && !flushScheduled) {
		flushScheduled = true;
		setTimeout(flushQueue, 0);
	}
}

/** Cached entry for a note (reactive in Svelte templates); requests it when missing. */
export function getCachedNoteTitle(noteId: string): CachedNoteTitle | null | undefined {
	if (!titleCache.has(noteId)) requestNoteTitles([noteId]);
	return titleCache.get(noteId);
}

/** The text a wiki-link should show: explicit label, else the note title, else the ID. */
export function wikiLinkDisplayText(noteId: string, label?: string | null): string {
	if (label && label !== noteId) return label;
	return getCachedNoteTitle(noteId)?.displayTitle || noteId;
}

/** Record a title the client already knows (after a save or create), so links update live. */
export function rememberNoteTitle(noteId: string, entry: CachedNoteTitle): void {
	const previous = titleCache.get(noteId);
	requestedIds.add(noteId);
	if (
		previous &&
		previous.displayTitle === entry.displayTitle &&
		previous.contractId === entry.contractId
	) {
		return;
	}
	titleCache.set(noteId, entry);
	notifyListeners();
}

/** Mark a note as gone (deleted). */
export function forgetNoteTitle(noteId: string): void {
	titleCache.set(noteId, null);
	notifyListeners();
}

/** Called whenever any cached title changes; returns an unsubscribe function. */
export function subscribeToNoteTitles(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Test helper: empty the cache. */
export function _resetNoteTitleCache(): void {
	titleCache.clear();
	requestedIds.clear();
	queuedIds.clear();
	listeners.clear();
	flushScheduled = false;
}
