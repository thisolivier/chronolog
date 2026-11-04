/**
 * Sprint 037-CL: delete in the browser moves a note to the server trash. The "Moved to trash. Undo"
 * toast restores it; the note list and the sidebar count follow both ways. A wiki-link to a trashed
 * note renders as "deleted" and offers an inline restore, which brings the note back and opens it.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContract, createNote, editor, noteListItem, openNoteId, sidebarContract } from './notes-helpers';

const SCREENSHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'review', 'screenshots', 'sprint-037');

const sidebarCount = (page: Page, contractName: string) =>
	sidebarContract(page, contractName).getByTestId('sidebar-note-count');

async function deleteOpenNote(page: Page) {
	await page.getByTestId('note-editor-header').getByRole('button', { name: 'Delete' }).click();
	await page.getByTestId('delete-confirm').getByRole('button', { name: 'Delete' }).click();
}

test('delete moves a note to the trash; Undo and a deleted wiki-link both restore it', async ({ page, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const contractName = await createContract(page, `Trash ${suffix}`);
	await page.reload();
	await sidebarContract(page, contractName).click();

	const titleA = `Trash target ${suffix}`;
	const noteA = await createNote(page, titleA);
	const titleB = `Trash source ${suffix}`;
	const contractId = await page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.contractId, noteA);
	const created = await page.evaluate(
		async ({ contractId, titleB, noteA }) => {
			const response = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, title: titleB, content: `# ${titleB}\n\nSee [[${noteA}]] for the plan.\n` })
			});
			return response.status;
		},
		{ contractId, titleB, noteA }
	);
	expect(created).toBe(201);
	await page.reload();
	await expect(noteListItem(page, titleB)).toBeVisible();
	await expect(sidebarCount(page, contractName)).toHaveText('2');

	// Delete A in the browser: gone from the list and the count, toast offers Undo
	await noteListItem(page, titleA).click();
	await expect(editor(page)).toContainText(titleA);
	await deleteOpenNote(page);
	const toast = page.getByTestId('note-trash-toast');
	await expect(toast).toContainText('Moved to trash.');
	await expect(noteListItem(page, titleA)).toHaveCount(0);
	await expect(sidebarCount(page, contractName)).toHaveText('1');
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '02-undo-toast.png') });

	// Undo: back in the list and the count, and open again with the same ID
	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(toast).toHaveCount(0);
	await expect(noteListItem(page, titleA)).toBeVisible();
	await expect(sidebarCount(page, contractName)).toHaveText('2');
	await expect(editor(page)).toContainText(titleA);
	expect(await openNoteId(page)).toBe(noteA);

	// Delete again, then open B: its link to A is a muted "deleted" link
	await deleteOpenNote(page);
	await expect(noteListItem(page, titleA)).toHaveCount(0);
	await noteListItem(page, titleB).click();
	const link = editor(page).locator(`[data-wiki-link][data-note-id="${noteA}"]`);
	await expect(link).toHaveClass(/wiki-link-deleted/);
	await expect(link).toHaveText(titleA);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '01-deleted-wiki-link.png') });

	// Clicking it offers a restore; Restore brings A back and opens it
	await link.click();
	const prompt = page.getByTestId('trashed-link-prompt');
	await expect(prompt).toContainText('is in the trash');
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '03-restore-prompt.png') });
	await prompt.getByRole('button', { name: 'Restore' }).click();
	await expect(prompt).toHaveCount(0);
	await expect(editor(page)).toContainText(titleA);
	expect(await openNoteId(page)).toBe(noteA);
	await expect(noteListItem(page, titleA)).toBeVisible();
	await expect(sidebarCount(page, contractName)).toHaveText('2');
});
