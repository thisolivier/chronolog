/**
 * `notes-changed` window event (sprint 026-CL, findings 18/23): fired by the DataService after a
 * note is created, deleted or moved to another contract, so the sidebar's per-contract note
 * counts refresh without every notes component having to remember to announce it.
 */
export const NOTES_CHANGED_EVENT = 'notes-changed';

export function announceNotesChanged(): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT));
}
