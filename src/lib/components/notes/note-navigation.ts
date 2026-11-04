import type { NavigationContext } from '$lib/stores/navigation.svelte';
import type { Backlink } from '$lib/services/types';
import { getCachedNoteTitle, rememberNoteTitle } from './note-titles.svelte';

/**
 * Open a note by ID from a wiki-link or backlink, switching the sidebar and note list to
 * the note's contract (`navigation.openNote`) instead of only swapping the editor.
 * Every way of opening a note from the notes UI goes through here, so the sidebar and
 * list always follow. Resolves `false` (and navigates nowhere) for a missing note or one in the
 * trash (callers check `isNoteInTrash` first to offer a restore).
 */
export function useNoteNavigation(navigation: NavigationContext) {
	async function resolveNoteLocation(noteId: string) {
		const cached = getCachedNoteTitle(noteId);
		if (cached?.deletedAt) return null;
		if (cached?.contractId && cached.clientId) return cached;
		try {
			const response = await fetch(`/api/notes/titles?ids=${encodeURIComponent(noteId)}&includeDeleted=1`);
			if (!response.ok) return null;
			const data = (await response.json()) as {
				titles: Array<{
					id: string;
					displayTitle: string | null;
					contractId: string;
					clientId: string;
					deletedAt?: string | null;
				}>;
			};
			const found = data.titles.find((title) => title.id === noteId);
			if (!found) return null;
			rememberNoteTitle(noteId, { ...found, deletedAt: found.deletedAt ?? null });
			return found.deletedAt ? null : found;
		} catch {
			return null;
		}
	}

	async function openNoteById(noteId: string): Promise<boolean> {
		const location = await resolveNoteLocation(noteId);
		if (!location) return false;
		navigation.openNote(noteId, location.contractId, location.clientId);
		return true;
	}

	function openBacklink(backlink: Backlink): void {
		if (backlink.noteContractId && backlink.noteClientId) {
			navigation.openNote(backlink.sourceNoteId, backlink.noteContractId, backlink.noteClientId);
		} else {
			void openNoteById(backlink.sourceNoteId);
		}
	}

	return { openNoteById, openBacklink };
}
