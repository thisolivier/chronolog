/** Shared helpers for the notes Playwright specs (sprint 024). */
import { expect, type Page } from '@playwright/test';

export const editor = (page: Page) => page.locator('[data-note-editor-content] .tiptap');

/**
 * A note list row by its title line (not its preview: since sprint 043 a preview can quote another
 * note's title through a wiki-link).
 */
export const noteListItem = (page: Page, text: string) =>
	page.locator('button').filter({ has: page.locator('span.truncate', { hasText: text }) }).first();

/** Sidebar contract button (its label starts with the contract name). */
export const sidebarContract = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^${name}`) }).first();

/**
 * Run an item of the editor header's "Note actions" menu (054-DR: Move, Export as Markdown,
 * Export as PDF, Delete / Discard live there). Move then lists the contracts as menu items.
 */
export async function chooseNoteAction(page: Page, item: string | RegExp) {
	await page.getByTestId('note-editor-header').getByRole('button', { name: 'Note actions' }).click();
	await page.getByRole('menu', { name: 'Note actions' }).getByRole('menuitem', { name: item }).click();
}

/** Move the open note through Note actions → Move → the contract whose item matches `contract` */
export async function moveOpenNote(page: Page, contract: string | RegExp) {
	await chooseNoteAction(page, /^Move/);
	await page.getByRole('menu', { name: 'Move note to' }).getByRole('menuitem', { name: contract }).click();
}

/**
 * The note list and editor are scoped to `contractId` (054-DR). With the sidebar beside them the
 * contract's name is only screen-reader text there, so check the scope by ID and the visible title.
 */
export async function expectNotesScopedTo(page: Page, contractId: string, { editorToo = true } = {}) {
	await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-contract-id', contractId);
	await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'notes');
	await expect(page.getByTestId('note-list-title')).toHaveText('Notes');
	if (editorToo) await expect(page.getByTestId('note-editor-context')).toHaveAttribute('data-contract-id', contractId);
}

export const openNoteId = async (page: Page) =>
	(await page.getByTestId('note-editor-header').locator('span.font-mono').innerText()).trim();

/** The selected sidebar contract is drawn in the pine "selected" style. */
export async function expectSidebarSelected(page: Page, name: string) {
	await expect(sidebarContract(page, name)).toHaveClass(/pine/);
}

/** Create a note in the current contract through the UI; returns its ID once saved. */
export async function createNote(page: Page, firstLine: string): Promise<string> {
	await page.getByRole('button', { name: 'New Note' }).click();
	await expect(editor(page)).toBeFocused();
	await page.keyboard.type(firstLine);
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
		timeout: 10000
	});
	await expect(noteListItem(page, firstLine)).toBeVisible();
	return openNoteId(page);
}

/** Create a contract under the user's first client through the API; returns its name. */
export async function createContract(page: Page, name: string): Promise<string> {
	const status = await page.evaluate(async (contractName) => {
		const contracts = await (await fetch('/api/contracts')).json();
		const response = await fetch('/api/contracts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ clientId: contracts[0].clientId, name: contractName, isActive: true })
		});
		return response.status;
	}, name);
	expect(status).toBeLessThan(300);
	return name;
}
