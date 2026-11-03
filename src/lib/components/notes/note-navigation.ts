import type { NavigationContext } from '$lib/stores/navigation.svelte';
import type { Backlink } from '$lib/services/types';
import { getCachedNoteTitle, rememberNoteTitle } from './note-titles.svelte';

/**
 * Open a note by ID from a wiki-link or backlink, switching the sidebar and note list to
 * the note's contract (`navigation.openNote`) instead of only swapping the editor.
 * Falls back to `selectNote` if the note's contract cannot be resolved.
 */
export function useNoteNavigation(navigation: NavigationContext) {
	async function resolveNoteLocation(noteId: string) {
		const cached = getCachedNoteTitle(noteId);
		if (cached?.contractId && cached.clientId) return cached;
		try {
			const response = await fetch(`/api/notes/titles?ids=${encodeURIComponent(noteId)}`);
			if (!response.ok) return null;
			const data = (await response.json()) as {
				titles: Array<{ id: string; displayTitle: string | null; contractId: string; clientId: string }>;
			};
			const found = data.titles.find((title) => title.id === noteId);
			if (!found) return null;
			rememberNoteTitle(noteId, found);
			return found;
		} catch {
			return null;
		}
	}

	async function openNoteById(noteId: string): Promise<void> {
		const location = await resolveNoteLocation(noteId);
		if (location) {
			navigation.openNote(noteId, location.contractId, location.clientId);
		} else {
			navigation.selectNote(noteId);
		}
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
