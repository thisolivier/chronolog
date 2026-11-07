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
