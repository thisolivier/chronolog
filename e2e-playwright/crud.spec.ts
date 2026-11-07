/**
 * CRUD smoke tests — verify creating, reading, editing, and deleting
 * a note through the actual UI. This exercises the full
 * DataService -> API -> DB pipeline.
 */

import { test, expect } from '@playwright/test';

test.describe('Note CRUD', () => {
	// Storage state is applied by the project config (chromium/webkit depend on auth-setup)

	test('create, view, edit, and delete a note', async ({ page }) => {
		// Set up the dialog handler BEFORE any actions that might trigger it
		page.on('dialog', async (dialog) => {
			await dialog.accept();
		});

		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// --- Navigate to notes mode by clicking the "General" contract ---
		const generalContract = page.getByText('General').first();
		await generalContract.click();
		await expect(page.getByTestId('note-list-context')).toBeVisible({ timeout: 5000 });

		// --- CREATE: Click "New Note" button ---
		const newNoteButton = page.getByRole('button', { name: 'New Note' });
		await expect(newNoteButton).toBeVisible({ timeout: 5000 });
		await newNoteButton.click();

		// Wait for the editor to appear (TipTap editor has a contenteditable div)
		const editorArea = page.locator('[contenteditable="true"]');
		await expect(editorArea).toBeVisible({ timeout: 10000 });

		// --- EDIT: Type content into the note editor ---
		const uniqueTitle = `PW Test ${Date.now()}`;
		await editorArea.click();
		await page.keyboard.type(uniqueTitle, { delay: 15 });
		await page.keyboard.press('Enter');
		await page.keyboard.type('Body of the test note.', { delay: 15 });

		// Wait for auto-save debounce to complete
		await page.waitForTimeout(3000);

		// --- READ: Verify the note title appears in the note list (panel 2) ---
		// The note list is a sibling panel to the editor — scope to the list area
		// NoteListPanel has a "divide-y" container with note buttons
		const noteListItem = page.locator('.divide-y button', { hasText: uniqueTitle });
		await expect(noteListItem).toBeVisible({ timeout: 10000 });

		// --- DELETE: Click the note in the list to select it, then delete ---
		await noteListItem.click();
		await page.waitForTimeout(500);

		// Delete lives in the editor header's Note actions menu (054-DR) and asks for confirmation inline (sprint 024)
		const actionsButton = page.getByTestId('note-editor-header').getByRole('button', { name: 'Note actions' });
		await expect(actionsButton).toBeVisible({ timeout: 5000 });
		await actionsButton.click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		await page.getByTestId('delete-confirm').getByRole('button', { name: 'Delete' }).click();

		// --- VERIFY DELETION: The note should no longer appear in the note list ---
		await expect(noteListItem).not.toBeVisible({ timeout: 10000 });
	});
});
