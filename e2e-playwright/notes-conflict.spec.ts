/**
 * Sprint 024 (journey review B-03): the same note open in two tabs. A save based on an
 * outdated copy is refused (409) and the editor says so instead of overwriting.
 */
import { test, expect } from '@playwright/test';
import { editor, noteListItem, sidebarContract, createNote } from './notes-helpers';

test('a stale tab gets "changed elsewhere" instead of overwriting the other tab', async ({ context }) => {
	const title = `Shared ${Date.now().toString(36)}`;
	const firstTab = await context.newPage();
	await firstTab.goto('/');
	await sidebarContract(firstTab, 'General').click();
	const noteId = await createNote(firstTab, title);

	const secondTab = await context.newPage();
	await secondTab.goto('/');
	await sidebarContract(secondTab, 'General').click();
	await noteListItem(secondTab, title).click();
	await expect(editor(secondTab)).toContainText(title);

	// Tab 1 edits and saves
	await firstTab.bringToFront();
	await editor(firstTab).click();
	await firstTab.keyboard.press('End');
	await firstTab.keyboard.type(' edited in tab one');
	await expect(firstTab.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });

	// Tab 2 still has the old copy: its save is refused
	await secondTab.bringToFront();
	await editor(secondTab).click();
	await secondTab.keyboard.press('End');
	await secondTab.keyboard.type(' typed in stale tab two');
	const status = secondTab.getByTestId('save-status');
	await expect(status).toHaveAttribute('data-status', 'conflict', { timeout: 10000 });
	await expect(status).toContainText('This note changed elsewhere, reload to see it');

	// Tab 1's text is what the server kept
	const serverContent = await secondTab.evaluate(
		async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.content as string,
		noteId
	);
	expect(serverContent).toContain('edited in tab one');
	expect(serverContent).not.toContain('stale tab two');

	// Reload shows tab 1's version and saving works again
	await secondTab.getByTestId('reload-note').click();
	await expect(editor(secondTab)).toContainText('edited in tab one');
	await expect(secondTab.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});
