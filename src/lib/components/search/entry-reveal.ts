/**
 * Opening a time-entry search hit (sprint 042-CL): once the timesheet has rendered the entry's
 * card, scroll it to the middle, focus it and outline it briefly. Waits for the card (the week
 * loads after navigating) and gives up quietly after a few seconds.
 */
import { ENTRY_ID_ATTRIBUTE } from '$lib/components/weekly/entry-focus';

const WAIT_LIMIT_MS = 5000;
const OUTLINE_MS = 2500;
export const REVEALED_ATTRIBUTE = 'data-search-revealed';

function findCard(entryId: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[${ENTRY_ID_ATTRIBUTE}="${CSS.escape(entryId)}"]`);
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForCard(entryId: string): Promise<HTMLElement | null> {
	const existing = findCard(entryId);
	if (existing) return Promise.resolve(existing);
	return new Promise((resolve) => {
		const observer = new MutationObserver(() => {
			const card = findCard(entryId);
			if (!card) return;
			finish(card);
		});
		const timeout = setTimeout(() => finish(null), WAIT_LIMIT_MS);
		function finish(card: HTMLElement | null) {
			observer.disconnect();
			clearTimeout(timeout);
			resolve(card);
		}
		observer.observe(document.body, { childList: true, subtree: true });
	});
}

export async function revealTimeEntry(entryId: string): Promise<boolean> {
	const card = await waitForCard(entryId);
	if (!card) return false;
	// Let the timesheet place its day first (it positions the list after rendering)
	await nextFrame();
	await nextFrame();
	card.scrollIntoView({ block: 'center' });
	card.focus({ preventScroll: true });
	card.setAttribute(REVEALED_ATTRIBUTE, '');
	const previousOutline = card.style.outline;
	card.style.outline = '2px solid var(--color-ochre-400)';
	card.style.outlineOffset = '2px';
	setTimeout(() => {
		card.removeAttribute(REVEALED_ATTRIBUTE);
		card.style.outline = previousOutline;
		card.style.outlineOffset = '';
	}, OUTLINE_MS);
	return true;
}
