import { SvelteMap } from 'svelte/reactivity';
import type { PreviewTextOptions } from '$lib/utils/wiki-link-text';

/**
 * Client-side cache of note display titles, used wherever a `[[id]]` wiki-link is
 * rendered (editor chips, time-entry cards, "Linked from", linked time entries).
 *
 * Lookups are batched into one `GET /api/notes/titles?ids=&includeDeleted=1` request per tick, so a
 * link to a note in the trash is known as such (`deletedAt`) and renders as a muted "deleted"
 * link that offers a restore (sprint 037-CL). The map is
 * a `SvelteMap`, so Svelte templates re-render when a title arrives; non-Svelte code (the
 * TipTap node view) uses `subscribeToNoteTitles`.
 */

export type CachedNoteTitle = {
	displayTitle: string | null;
	contractId: string;
	clientId: string;
	/** Set while the note is in the trash (ISO string); absent or null for a live note */
	deletedAt?: string | null;
};

/** `null` = looked up and not found (purged, or not the user's note) */
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
		const response = await fetch(
			`/api/notes/titles?ids=${encodeURIComponent(noteIds.join(','))}&includeDeleted=1`
		);
		if (!response.ok) throw new Error(`titles request failed (${response.status})`);
		const data = (await response.json()) as {
			titles: Array<{ id: string } & CachedNoteTitle>;
		};
		const found = new Set<string>();
		for (const { id, displayTitle, contractId, clientId, deletedAt } of data.titles) {
			titleCache.set(id, { displayTitle, contractId, clientId, deletedAt: deletedAt ?? null });
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

/**
 * Preview options that read wiki-links as the cached title of their target (sprint 043-CL):
 * for the title an editor saves and the previews it announces.
 */
export const cachedTitlePreviewOptions: PreviewTextOptions = {
	resolveNoteTitle: (noteId) => getCachedNoteTitle(noteId)?.displayTitle
};

/** Record a title the client already knows (after a save or create), so links update live. */
export function rememberNoteTitle(noteId: string, entry: CachedNoteTitle): void {
	const previous = titleCache.get(noteId);
	requestedIds.add(noteId);
	if (
		previous &&
		previous.displayTitle === entry.displayTitle &&
		previous.contractId === entry.contractId &&
		(previous.deletedAt ?? null) === (entry.deletedAt ?? null)
	) {
		return;
	}
	titleCache.set(noteId, entry);
	notifyListeners();
}

/** Mark a note as gone (not found). */
export function forgetNoteTitle(noteId: string): void {
	titleCache.set(noteId, null);
	notifyListeners();
}

/** True when the note is known to be in the trash (reactive in Svelte templates). */
export function isNoteInTrash(noteId: string): boolean {
	return Boolean(getCachedNoteTitle(noteId)?.deletedAt);
}

/** Record that a note went to the trash (`deletedAt`) or came back from it (`null`). */
export function setNoteTrashed(noteId: string, deletedAt: string | null): void {
	const previous = titleCache.get(noteId);
	if (!previous) {
		// Unknown here: look it up, so links learn its title and state
		requestedIds.delete(noteId);
		titleCache.delete(noteId);
		requestNoteTitles([noteId]);
		return;
	}
	rememberNoteTitle(noteId, { ...previous, deletedAt });
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
