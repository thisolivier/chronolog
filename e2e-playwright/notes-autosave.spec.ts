/**
 * Sprint 024 task 1: note text typed right before leaving the editor is never lost.
 *
 * Each test types and IMMEDIATELY leaves the editor (no wait for the 500 ms autosave
 * debounce): switch note, reload, switch contract. After a reload the text must be there.
 */
import { test, expect, type Page } from '@playwright/test';
import { editor, noteListItem, createNote } from './notes-helpers';

async function openGeneralContract(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: /General/ }).first().click();
	await expect(page.getByRole('button', { name: 'New Note' })).toBeVisible();
}

test.describe('note autosave never loses text', () => {
	test('type, immediately switch note, reload: the text is there', async ({ page }) => {
		const suffix = Date.now().toString(36);
		const alphaTitle = `Alpha ${suffix}`;
		const betaTitle = `Beta ${suffix}`;
		await openGeneralContract(page);
		await createNote(page, alphaTitle);
		await createNote(page, betaTitle);

		await noteListItem(page, alphaTitle).click();
		await expect(editor(page)).toContainText(alphaTitle);
		await editor(page).click();
		await page.keyboard.press('End');
		await page.keyboard.type(' switched-away-instantly');
		// No waiting: switch note straight away
		await noteListItem(page, betaTitle).click();
		await expect(editor(page)).toContainText(betaTitle);

		await page.reload();
		await page.getByRole('button', { name: /General/ }).first().click();
		await noteListItem(page, alphaTitle).click();
		await expect(editor(page)).toContainText(`${alphaTitle} switched-away-instantly`);
	});

	test('type, immediately reload: the text is there', async ({ page }) => {
		const title = `Gamma ${Date.now().toString(36)}`;
		await openGeneralContract(page);
		await createNote(page, title);

		await page.keyboard.type(' reloaded-instantly');
		await page.reload();

		await page.getByRole('button', { name: /General/ }).first().click();
		await noteListItem(page, title).click();
		await expect(editor(page)).toContainText(`${title} reloaded-instantly`);
	});

	test('type, immediately switch to Time Entries: the text is there', async ({ page }) => {
		const title = `Delta ${Date.now().toString(36)}`;
		await openGeneralContract(page);
		await createNote(page, title);

		await page.keyboard.type(' left-for-time-entries');
		await page.getByRole('button', { name: 'Time Entries' }).click();

		await page.reload();
		await page.getByRole('button', { name: /General/ }).first().click();
		await noteListItem(page, title).click();
		await expect(editor(page)).toContainText(`${title} left-for-time-entries`);
	});
});
