/**
 * `use:enhance` callbacks shared by the admin forms (sprint 026-CL): add-forms and inline edits
 * close only when the server accepted the change, so a rejected form keeps what was typed.
 */
import type { SubmitFunction } from '@sveltejs/kit';

export function closeOnSuccess(close: () => void): SubmitFunction {
	return () =>
		async ({ result, update }) => {
			if (result.type === 'success') close();
			await update({ reset: result.type === 'success' });
		};
}

/** Svelte action for inline-edit and add forms: Escape cancels instead of saving. */
export function escapeCancels(node: HTMLElement, cancel: () => void) {
	let currentCancel = cancel;
	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		currentCancel();
	};
	node.addEventListener('keydown', handleKeydown);
	return {
		update(nextCancel: () => void) {
			currentCancel = nextCancel;
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
		}
	};
}
