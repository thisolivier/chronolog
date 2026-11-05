/**
 * Sprint 024 (journey review B-02, A-01): opening a note from inside the notes UI moves
 * the sidebar and note list to that note's contract, and a moved note stays open.
 */
import { test, expect } from '@playwright/test';
import {
	editor,
	noteListItem,
	sidebarContract,
	openNoteId,
	expectSidebarSelected,
	createNote,
	createContract
} from './notes-helpers';

test('wiki-links, "Linked from" chips and search open notes in their own contract', async ({ page }) => {
	const suffix = Date.now().toString(36);
	await page.goto('/');
	const otherContract = await createContract(page, `Orbit ${suffix}`);
	await page.reload();

	// Target note in the other contract
	await sidebarContract(page, otherContract).click();
	const targetTitle = `Target ${suffix}`;
	const targetId = await createNote(page, targetTitle);

	// Source note in General links to it
	await sidebarContract(page, 'General').click();
	const sourceTitle = `Source ${suffix}`;
	const sourceId = await createNote(page, sourceTitle);
	await page.keyboard.press('Enter');
	await page.keyboard.type(`See [[${targetId}`);
	await expect(page.locator('body > div.absolute.z-50')).toContainText(targetId);
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });

	// Editor wiki-link → other contract
	await editor(page).locator('[data-wiki-link]').first().click();
	await expect.poll(() => openNoteId(page)).toBe(targetId);
	await expectSidebarSelected(page, otherContract);
	await expect(noteListItem(page, targetTitle)).toBeVisible();

	// "Linked from" chip → back to General
	await page.getByTestId('note-backlinks').getByRole('button', { name: sourceTitle }).click();
	await expect.poll(() => openNoteId(page)).toBe(sourceId);
	await expectSidebarSelected(page, 'General');
	await expect(noteListItem(page, sourceTitle)).toBeVisible();

	// Search hit (top-bar search; the note list's own box went in 051-UI) → other contract
	await page.getByTestId('global-search-input').fill(targetTitle);
	await page.getByTestId('global-search-input').press('Enter');
	await page.getByTestId('search-hit-note').filter({ hasText: targetTitle }).first().click();
	await expect.poll(() => openNoteId(page)).toBe(targetId);
	await expectSidebarSelected(page, otherContract);
});

test('moving a note keeps it open under its new contract', async ({ page }) => {
	const suffix = Date.now().toString(36);
	await page.goto('/');
	const destination = await createContract(page, `Lander ${suffix}`);
	await page.reload();

	await sidebarContract(page, 'General').click();
	const title = `Moving ${suffix}`;
	const noteId = await createNote(page, title);

	await page.getByRole('button', { name: 'Move', exact: true }).click();
	await page.locator('[data-move-menu]').getByRole('button', { name: new RegExp(destination) }).click();

	await expect(page.getByTestId('move-feedback')).toContainText(destination);
	await expectSidebarSelected(page, destination);
	await expect(noteListItem(page, title)).toBeVisible();
	expect(await openNoteId(page)).toBe(noteId);
	await expect(editor(page)).toContainText(title);

	// Still editable and saving under the new contract
	await editor(page).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' after move');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
	await page.reload();
	await sidebarContract(page, destination).click();
	await noteListItem(page, title).click();
	await expect(editor(page)).toContainText(`${title} after move`);
});
