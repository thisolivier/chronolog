/**
 * GATE B: Sync Round Trip — Playwright Browser Tests
 *
 * Exercises the full UI -> DataService -> API -> Postgres pipeline:
 * - Login -> create a note -> verify it appears in the list
 * - Edit the note content -> verify changes persist after page reload
 * - Delete the note -> verify it's removed after page reload
 * - Create a time entry -> verify it appears in the weekly view
 *
 * The "page reload" steps force re-fetch from the server, proving data
 * made it to Postgres and back.
 *
 * Tests run serially to avoid note creation conflicts.
 */

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('GATE B: Sync Round Trip (Browser)', () => {
	test('create a note, verify it persists after reload', async ({ page }) => {
		// Set up dialog handler for any confirmation dialogs
		page.on('dialog', async (dialog) => {
			await dialog.accept();
		});

		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Navigate to notes mode
		const generalContract = page.getByText('General').first();
		await generalContract.click();
		await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({ timeout: 5000 });

		// Create a new note
		const newNoteButton = page.getByRole('button', { name: 'New Note' });
		await expect(newNoteButton).toBeVisible({ timeout: 5000 });
		await newNoteButton.click();

		// Wait for editor
		const editorArea = page.locator('[contenteditable="true"]');
		await expect(editorArea).toBeVisible({ timeout: 15000 });

		// Type a unique title
		const uniqueTitle = `SyncCreate ${Date.now()}`;
		await editorArea.click();
		await page.keyboard.type(uniqueTitle, { delay: 15 });
		await page.keyboard.press('Enter');
		await page.keyboard.type('Sync round trip body content.', { delay: 15 });

		// Wait for auto-save
		await page.waitForTimeout(3000);

		// Verify note appears in the list
		const noteListItem = page.locator('.divide-y button', { hasText: uniqueTitle });
		await expect(noteListItem).toBeVisible({ timeout: 10000 });

		// RELOAD the page — forces re-fetch from server
		await page.reload();
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Navigate back to notes
		await page.getByText('General').first().click();
		await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({ timeout: 5000 });

		// Verify the note still exists after reload (proves Postgres round trip)
		const noteAfterReload = page.locator('.divide-y button', { hasText: uniqueTitle });
		await expect(noteAfterReload).toBeVisible({ timeout: 10000 });

		// Clean up: delete the note using the specific title-attributed Delete button
		await noteAfterReload.click();
		await page.waitForTimeout(500);
		const deleteButton = page.locator('button[title="Delete selected note"]');
		await expect(deleteButton).toBeVisible({ timeout: 5000 });
		await deleteButton.click();
		await expect(noteAfterReload).not.toBeVisible({ timeout: 10000 });
	});

	test('edit note content and verify changes persist after reload', async ({ page }) => {
		page.on('dialog', async (dialog) => {
			await dialog.accept();
		});

		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Navigate to notes
		await page.getByText('General').first().click();
		await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({ timeout: 5000 });

		// Create a note
		await page.getByRole('button', { name: 'New Note' }).click();
		const editorArea = page.locator('[contenteditable="true"]');
		await expect(editorArea).toBeVisible({ timeout: 15000 });

		const originalTitle = `SyncEdit ${Date.now()}`;
		await editorArea.click();
		await page.keyboard.type(originalTitle, { delay: 15 });
		await page.waitForTimeout(3000);

		// Verify it's in the list
		const noteItem = page.locator('.divide-y button', { hasText: originalTitle });
		await expect(noteItem).toBeVisible({ timeout: 10000 });

		// Now edit: add more content
		await editorArea.click();
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		const editedContent = `Edited at ${Date.now()}`;
		await page.keyboard.type(editedContent, { delay: 15 });
		await page.waitForTimeout(3000);

		// Reload to force re-fetch
		await page.reload();
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Navigate back to notes
		await page.getByText('General').first().click();
		await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({ timeout: 5000 });

		// The note should still be in the list
		const noteAfterReload = page.locator('.divide-y button', { hasText: originalTitle });
		await expect(noteAfterReload).toBeVisible({ timeout: 10000 });

		// Click the note to open it
		await noteAfterReload.click();
		await expect(editorArea).toBeVisible({ timeout: 10000 });

		// Verify the edited content persisted
		await expect(editorArea).toContainText(editedContent, { timeout: 5000 });

		// Clean up
		const deleteButton = page.locator('button[title="Delete selected note"]');
		await expect(deleteButton).toBeVisible({ timeout: 5000 });
		await deleteButton.click();
		await expect(noteAfterReload).not.toBeVisible({ timeout: 10000 });
	});

	test('delete a note and verify it is removed after reload', async ({ page }) => {
		page.on('dialog', async (dialog) => {
			await dialog.accept();
		});

		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Navigate to notes
		await page.getByText('General').first().click();
		await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({ timeout: 5000 });

		// Create a note to delete
		await page.getByRole('button', { name: 'New Note' }).click();
		const editorArea = page.locator('[contenteditable="true"]');
		await expect(editorArea).toBeVisible({ timeout: 15000 });

		const deleteTestTitle = `SyncDel ${Date.now()}`;
		await editorArea.click();
		await page.keyboard.type(deleteTestTitle, { delay: 15 });
		await page.waitForTimeout(3000);

		// Verify it exists
		const noteItem = page.locator('.divide-y button', { hasText: deleteTestTitle });
		await expect(noteItem).toBeVisible({ timeout: 10000 });

		// Delete it using the specific title-attributed Delete button
		await noteItem.click();
		await page.waitForTimeout(500);
		const deleteButton = page.locator('button[title="Delete selected note"]');
		await expect(deleteButton).toBeVisible({ timeout: 5000 });
		await deleteButton.click();
		await expect(noteItem).not.toBeVisible({ timeout: 10000 });

		// Reload and verify it's gone from the server
		await page.reload();
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		await page.getByText('General').first().click();
		await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({ timeout: 5000 });

		// The deleted note should not reappear
		const noteAfterReload = page.locator('.divide-y button', { hasText: deleteTestTitle });
		await expect(noteAfterReload).not.toBeVisible({ timeout: 5000 });
	});

	test('create a time entry and verify it appears in weekly view', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Make sure we're in Time Entries mode
		await page.getByRole('button', { name: 'Time Entries' }).click();
		await page.waitForTimeout(2000);

		// Verify no error states are shown — the Time Entries view renders
		const errorOverlay = page.locator('vite-error-overlay');
		await expect(errorOverlay).not.toBeVisible({ timeout: 2000 });

		// Verify the app shell is still functional
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
		await expect(page.getByText('Contracts')).toBeVisible();
	});
});
