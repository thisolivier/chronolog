/**
 * "New Note" draft state shared by NoteListPanel (starts a draft) and NoteEditorPanel
 * (shows an empty editor for it). Nothing is persisted until the first keystroke: the
 * editor panel creates the note on its first save, then selects it.
 */

export const noteDraft = $state<{ token: number; contractId: string | null }>({
	token: 0,
	contractId: null
});

/** Start (or restart) a draft for a contract. */
export function startNoteDraft(contractId: string): void {
	noteDraft.contractId = contractId;
	noteDraft.token += 1;
}

export function endNoteDraft(): void {
	noteDraft.contractId = null;
}
