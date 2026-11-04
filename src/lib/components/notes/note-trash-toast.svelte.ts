/**
 * "Moved to trash. Undo" after a note is deleted (sprint 037-CL), held at module level since
 * sprint 043-CL so the toast outlives the editor panel: on a phone the panel unmounts as soon as
 * the note closes. `NoteTrashToastHost.svelte` (mounted once by the workspace layout) shows it.
 */
export type TrashToast = { noteId: string; contractId: string; clientId: string };

export const TRASH_TOAST_MILLISECONDS = 10_000;

export const trashToastState = $state<{ toast: TrashToast | null; error: string | null }>({ toast: null, error: null });

let hideTimeout: ReturnType<typeof setTimeout> | undefined;

/** Show the toast for ten seconds (replacing any earlier one). */
export function showTrashToast(toast: TrashToast): void {
	trashToastState.toast = toast;
	trashToastState.error = null;
	clearTimeout(hideTimeout);
	hideTimeout = setTimeout(dismissTrashToast, TRASH_TOAST_MILLISECONDS);
}

/** Hide the toast; returns what it showed, if anything. */
export function dismissTrashToast(): TrashToast | null {
	const toast = trashToastState.toast;
	trashToastState.toast = null;
	clearTimeout(hideTimeout);
	return toast;
}

/** Briefly show an error in the toast's place (a failed Undo). */
export function showTrashToastError(message: string): void {
	trashToastState.error = message;
	clearTimeout(hideTimeout);
	hideTimeout = setTimeout(() => (trashToastState.error = null), 3000);
}
