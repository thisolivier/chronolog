import type { NoteSummary } from '$lib/services/types';

/**
 * Note list order: pinned notes first, most recently pinned on top (sprint 039-CL), then newest by
 * modification or creation time.
 */
export type NoteSortOrder = 'modified' | 'created';

const SORT_STORAGE_KEY = 'chronolog.noteSortOrder';

export function sortNotes(notesList: NoteSummary[], order: NoteSortOrder): NoteSummary[] {
	const timestampOf = (note: NoteSummary) =>
		new Date(order === 'created' ? note.createdAt : note.updatedAt).getTime();
	// A pinned note without `pinnedAt` (an older answer) counts as pinned long ago
	const pinnedTimeOf = (note: NoteSummary) =>
		note.isPinned ? (note.pinnedAt ? new Date(note.pinnedAt).getTime() : 0) : -1;
	return [...notesList].sort(
		(left, right) => pinnedTimeOf(right) - pinnedTimeOf(left) || timestampOf(right) - timestampOf(left)
	);
}

/** Per-device preference; storage may be unavailable (private mode), so default quietly. */
export function loadSortPreference(): NoteSortOrder {
	try {
		return globalThis.localStorage?.getItem(SORT_STORAGE_KEY) === 'created' ? 'created' : 'modified';
	} catch {
		return 'modified';
	}
}

export function saveSortPreference(order: NoteSortOrder): void {
	try {
		globalThis.localStorage?.setItem(SORT_STORAGE_KEY, order);
	} catch {
		// ignore: the preference just won't persist
	}
}
