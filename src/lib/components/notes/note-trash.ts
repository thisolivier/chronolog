/**
 * Browser side of the note trash (sprint 037-CL).
 *
 * `restoreTrashedNote` takes a note out of the server-side trash, updates the shared title cache
 * (so every link to it turns live again) and announces `note-restored` (the note list and the
 * sidebar counts follow). `showRestorePrompt` is the small inline confirm a click on a "deleted"
 * wiki-link opens, next to the link; it is plain DOM so the TipTap node view and Svelte
 * components share it.
 */
import type { DataService } from '$lib/services/data-service';
import type { RestoredNote } from '$lib/services/types';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { dispatchNoteEvent } from './note-events';
import { getCachedNoteTitle, rememberNoteTitle } from './note-titles.svelte';

export async function restoreTrashedNote(dataService: DataService, noteId: string): Promise<RestoredNote> {
	const restored = await dataService.restoreNote(noteId);
	const cached = getCachedNoteTitle(noteId);
	rememberNoteTitle(noteId, {
		displayTitle: cached?.displayTitle ?? noteDisplayTitle(restored.note.title, restored.note.contentJson),
		contractId: restored.note.contractId,
		clientId: cached?.clientId ?? '',
		deletedAt: null
	});
	dispatchNoteEvent('note-restored', { noteId, contractId: restored.note.contractId });
	return restored;
}

let openPrompt: { element: HTMLElement; close: () => void } | null = null;

/** Close the restore prompt if one is open. */
export function closeRestorePrompt(): void {
	openPrompt?.close();
}

/**
 * Show "“Title” is in the trash. [Restore] [Cancel]" under `anchor`. `onRestore` runs on Restore;
 * if it throws, the prompt says so and stays open. Escape, Cancel or a click elsewhere close it.
 */
export function showRestorePrompt(
	anchor: HTMLElement,
	options: { title: string; onRestore: () => Promise<void> }
): HTMLElement {
	closeRestorePrompt();
	const prompt = document.createElement('div');
	prompt.setAttribute('role', 'dialog');
	prompt.setAttribute('aria-label', 'Restore deleted note');
	prompt.dataset.testid = 'trashed-link-prompt';
	prompt.className =
		'fixed z-50 flex max-w-xs flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 shadow-lg';

	const message = document.createElement('span');
	message.textContent = `“${options.title}” is in the trash.`;
	const restoreButton = document.createElement('button');
	restoreButton.type = 'button';
	restoreButton.textContent = 'Restore';
	restoreButton.className = 'rounded bg-indigo-600 px-2 py-0.5 font-medium text-white hover:bg-indigo-700';
	const cancelButton = document.createElement('button');
	cancelButton.type = 'button';
	cancelButton.textContent = 'Cancel';
	cancelButton.className = 'rounded px-2 py-0.5 text-stone-500 hover:bg-stone-100';
	prompt.append(message, restoreButton, cancelButton);

	const rectangle = anchor.getBoundingClientRect();
	prompt.style.left = `${Math.max(8, Math.min(rectangle.left, window.innerWidth - 300))}px`;
	prompt.style.top = `${rectangle.bottom + 4}px`;

	const onOutsidePointer = (event: PointerEvent) => {
		if (!prompt.contains(event.target as Node)) close();
	};
	const onKey = (event: KeyboardEvent) => {
		if (event.key === 'Escape') close();
	};
	function close() {
		prompt.remove();
		document.removeEventListener('pointerdown', onOutsidePointer, true);
		document.removeEventListener('keydown', onKey, true);
		if (openPrompt?.element === prompt) openPrompt = null;
	}

	cancelButton.addEventListener('click', close);
	restoreButton.addEventListener('click', async () => {
		restoreButton.disabled = true;
		try {
			await options.onRestore();
			close();
		} catch (restoreError) {
			console.error('Could not restore note:', restoreError);
			message.textContent = 'Could not restore it. Try again.';
			restoreButton.disabled = false;
		}
	});

	document.body.append(prompt);
	document.addEventListener('pointerdown', onOutsidePointer, true);
	document.addEventListener('keydown', onKey, true);
	openPrompt = { element: prompt, close };
	restoreButton.focus();
	return prompt;
}
