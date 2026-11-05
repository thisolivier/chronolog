/**
 * Sprint 047-QA: the main journeys on an iPhone (WebKit, Playwright device descriptors). Tagged
 * `@iphone`, so they run on the iphone-se, iphone-15 and iphone-15-pro-max projects; desktop
 * projects skip them. Each test signs up its own user (`$E2E_USER_PREFIX-iphone-…`).
 * Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to docs/review/screenshots/sprint-047/.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInAsFreshUser } from './fresh-user';
import { editor, noteListItem } from './notes-helpers';
import {
	expectInsideViewportWidth,
	expectNoSidewaysScroll,
	expectNoZoomingFields,
	expectTouchSized,
	iphoneScreenshot,
	seedIphoneData,
	uniqueSuffix
} from './iphone-helpers';

test.skip(({ isMobile }) => !isMobile, 'iPhone projects only');

async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

test('sign in, then the week: add, edit and delete an entry @iphone', async ({ page, baseURL }, testInfo) => {
	const email = await signInAsFreshUser(page, baseURL, 'iphone-week');
	const seed = await seedIphoneData(page, uniqueSuffix());

	await page.context().clearCookies();
	await open(page, '/login');
	await expectNoZoomingFields(page);
	await iphoneScreenshot(page, testInfo, '01-sign-in');
	await page.locator('#email').fill(email);
	await page.locator('#password').fill('FreshUser044!pass');
	await page.locator('button[type="submit"]').click();
	await page.waitForURL((url) => url.pathname === '/');

	await open(page, '/time');
	await expect(page.getByTestId('time-entry-card').first()).toBeVisible();
	await expectNoSidewaysScroll(page);
	await expectTouchSized(page.getByTestId('mobile-back'));
	await expectTouchSized(page.getByTestId('mobile-search-link'));
	await expectTouchSized(page.getByTestId('mobile-find-button'));
	await expectTouchSized(page.getByRole('button', { name: 'Previous week' }));
	await expectTouchSized(page.getByRole('button', { name: 'Next week' }));
	await expectTouchSized(page.getByRole('button', { name: /^Add entry for / }).first());
	await iphoneScreenshot(page, testInfo, '02-week');

	// Add an entry through the modal: every field at 16px or more (no zoom on focus)
	await page.getByRole('button', { name: 'Add Entry', exact: true }).last().click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await expectNoZoomingFields(page);
	await expectInsideViewportWidth(page, dialog.locator('> div').first());
	await iphoneScreenshot(page, testInfo, '03-add-entry');
	await dialog.locator('#entry-description').fill('Phone entry');
	const contractValue = await dialog.locator('#entry-contract option', { hasText: seed.contractName }).first().getAttribute('value');
	await dialog.locator('#entry-contract').selectOption(contractValue!);
	await dialog.locator('#entry-duration').fill('45m');
	await dialog.getByRole('button', { name: 'Save' }).click();
	const card = page.getByTestId('time-entry-card').filter({ hasText: 'Phone entry' });
	await expect(card).toBeVisible();

	// Edit the description in place
	await card.getByText('Phone entry').click();
	// The card swaps its text for the field, so find the field by the card, not by the text
	const descriptionField = page.locator('[data-testid="time-entry-card"] input[type="text"]').first();
	await expect(descriptionField).toBeFocused();
	await expectNoZoomingFields(page);
	await descriptionField.fill('Phone entry edited');
	await descriptionField.press('Enter');
	const editedCard = page.getByTestId('time-entry-card').filter({ hasText: 'Phone entry edited' });
	await expect(editedCard).toBeVisible();

	// Delete: the × is always shown on touch at a compact 32px (owner: tight is fine); Yes / No are finger-sized
	const deleteButton = editedCard.getByRole('button', { name: 'Delete entry' });
	const deleteBox = await deleteButton.boundingBox();
	expect(deleteBox!.width).toBeGreaterThanOrEqual(32);
	expect(deleteBox!.height).toBeGreaterThanOrEqual(32);
	await deleteButton.click();
	const confirmYes = editedCard.getByRole('button', { name: 'Yes' });
	await expectTouchSized(confirmYes);
	await confirmYes.click();
	await expect(page.getByTestId('time-entry-card').filter({ hasText: 'Phone entry edited' })).toHaveCount(0);
});

test('timer: start, adjust the start, stop and discard @iphone', async ({ page, baseURL }, testInfo) => {
	await signInAsFreshUser(page, baseURL, 'iphone-timer');
	await seedIphoneData(page, uniqueSuffix());
	await open(page, '/time');
	const widget = page.locator('[data-testid^="timer-widget-"]').first();
	await widget.getByRole('button', { name: 'Start Timer' }).click();
	const startField = widget.getByTestId('timer-start-time');
	await expect(startField).toBeVisible();
	await expectNoZoomingFields(page);
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '04-timer-running');

	await expectTouchSized(widget.getByRole('button', { name: 'Stop' }));
	await widget.getByRole('button', { name: 'Stop' }).click();
	await expect(widget.locator('#timer-time')).toBeVisible();
	await expectNoZoomingFields(page);
	await iphoneScreenshot(page, testInfo, '05-timer-stopped');
	await widget.getByRole('button', { name: /Discard/ }).click();
	await expect(widget.getByRole('button', { name: 'Start Timer' })).toBeVisible();
});

test('notes: list, editor, wiki-link list, menus, find and Undo @iphone', async ({ page, baseURL }, testInfo) => {
	await signInAsFreshUser(page, baseURL, 'iphone-notes');
	const seed = await seedIphoneData(page, uniqueSuffix());

	await open(page, `/notes/${seed.contractId}`);
	await expect(noteListItem(page, 'Kickoff notes')).toBeVisible();
	await expectNoZoomingFields(page);
	await expectTouchSized(page.getByRole('button', { name: 'Pin “Kickoff notes”' }));
	await iphoneScreenshot(page, testInfo, '06-note-list');

	await noteListItem(page, 'Kickoff notes').click();
	await expect(editor(page)).toContainText('Agenda for the kickoff');
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '07-note');

	await expectTouchSized(page.getByRole('button', { name: 'B', exact: true }));
	// The toolbar scrolls sideways inside itself; its last button can be reached
	const attachButton = page.getByRole('button', { name: 'Attach' });
	await attachButton.scrollIntoViewIfNeeded();
	await expectInsideViewportWidth(page, attachButton);

	// Wiki-link list stays on screen even with the caret near the right edge
	await editor(page).getByText('Send the proposal').click();
	await page.keyboard.press('End');
	await page.keyboard.type(' [[Stake');
	const suggestion = page.getByText('Stakeholder map', { exact: true }).last();
	await expect(suggestion).toBeVisible();
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '08-wiki-link-list');
	await page.keyboard.press('Escape');

	// Move menu opens on screen (it opened off the left edge before)
	await page.getByRole('button', { name: /^Move/ }).click();
	const moveMenu = page.locator('[data-move-menu] > div');
	await expect(moveMenu).toBeVisible();
	await expectInsideViewportWidth(page, moveMenu);
	await iphoneScreenshot(page, testInfo, '09-move-menu');
	await page.getByRole('button', { name: /^Move/ }).click();

	// Find in note from the title bar (no Cmd+F on a phone)
	await page.getByTestId('mobile-find-button').click();
	await expect(page.getByTestId('find-input')).toBeFocused();
	await page.getByTestId('find-input').fill('kickoff');
	await expect(page.getByTestId('find-count')).toHaveText(/of/);
	await expectNoZoomingFields(page);
	await iphoneScreenshot(page, testInfo, '10-find-in-note');
	await page.getByTestId('find-close').click();
	await expect(page.getByTestId('find-bar')).toHaveCount(0);

	// Delete, then Undo from the toast
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByTestId('delete-confirm').getByRole('button', { name: 'Delete' }).click();
	const toast = page.getByTestId('note-trash-toast');
	await expect(toast).toBeVisible();
	await expectInsideViewportWidth(page, toast);
	await iphoneScreenshot(page, testInfo, '11-undo-toast');
	await toast.getByRole('button', { name: 'Undo' }).click();
	// Undo restores the note and opens it again
	await expect(page).toHaveURL(new RegExp(seed.noteId.replace(/\./g, '\\.')));
	await expect(editor(page)).toContainText('Kickoff notes');
});

test('settings: clients stack with actions in view; archive and activate @iphone', async ({ page, baseURL }, testInfo) => {
	await signInAsFreshUser(page, baseURL, 'iphone-settings');
	const seed = await seedIphoneData(page, uniqueSuffix());

	await open(page, '/settings');
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '12-settings');

	await open(page, '/admin/clients');
	const archiveButton = page.getByRole('button', { name: `Archive ${seed.clientName}` });
	await expectInsideViewportWidth(page, archiveButton);
	await expectTouchSized(archiveButton);
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '13-clients');
	await archiveButton.click();
	const activateButton = page.getByRole('button', { name: `Activate ${seed.clientName}` });
	await expect(activateButton).toBeVisible();
	await activateButton.click();
	await expect(page.getByRole('button', { name: `Archive ${seed.clientName}` })).toBeVisible();

	// Inline edit: the fields stack inside the screen
	const clientRow = page.locator(`tr[data-client-id="${seed.clientId}"]`);
	await clientRow.getByRole('button', { name: 'Edit' }).click();
	const nameField = page.getByRole('textbox', { name: 'Client name' });
	await expect(nameField).toBeFocused();
	await expectInsideViewportWidth(page, nameField);
	await expectInsideViewportWidth(page, page.getByRole('combobox', { name: 'Client colour' }));
	await expectNoZoomingFields(page);
	await iphoneScreenshot(page, testInfo, '14-client-edit');
	await page.getByRole('button', { name: 'Cancel' }).click();

	for (const [path, name] of [
		['/settings/two-factor', '15-two-factor'],
		['/settings/api-tokens', '16-api-tokens']
	] as const) {
		await open(page, path);
		await expectNoSidewaysScroll(page);
		await expectNoZoomingFields(page);
		await iphoneScreenshot(page, testInfo, name);
	}
});

test('search from the title bar, the sidebar, and the offline banner @iphone', async ({ page, baseURL }, testInfo) => {
	await signInAsFreshUser(page, baseURL, 'iphone-search');
	const seed = await seedIphoneData(page, uniqueSuffix());

	// Sidebar (the phone's first screen): client chevron and rows are finger-sized
	await open(page, '/');
	await expect(page.getByRole('button', { name: `Collapse ${seed.clientName}` })).toBeVisible();
	const chevronBox = await page.getByRole('button', { name: `Collapse ${seed.clientName}` }).boundingBox();
	expect(chevronBox!.height).toBeGreaterThanOrEqual(44);
	await expectTouchSized(page.getByRole('button', { name: new RegExp(`^${seed.contractName}`) }).first());
	await expectTouchSized(page.getByRole('button', { name: 'Time Entries' }));
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '17-sidebar');

	// Client view from the client's name
	await page.getByRole('button', { name: seed.clientName, exact: true }).click();
	await expect(noteListItem(page, 'Kickoff notes')).toBeVisible();
	await expectNoSidewaysScroll(page);

	await page.getByTestId('mobile-search-link').click();
	await expect(page).toHaveURL(/\/search/);
	const searchField = page.getByTestId('global-search-input');
	await searchField.fill('kickoff');
	await searchField.press('Enter');
	await expect(page.getByText('Kickoff notes').first()).toBeVisible();
	await expectNoZoomingFields(page);
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '18-search');

	// Offline: the banner's dot sits beside its text, not on a line of its own
	await open(page, '/time');
	await page.context().setOffline(true);
	await page.evaluate(() => window.dispatchEvent(new Event('offline')));
	const banner = page.getByTestId('connection-status-offline');
	await expect(banner).toBeVisible();
	const bannerBox = await banner.boundingBox();
	expect(bannerBox!.height, 'banner is at most three lines').toBeLessThan(80);
	await iphoneScreenshot(page, testInfo, '19-offline-banner');
	await page.context().setOffline(false);
});

test('landscape on the standard iPhone: week and note @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'iphone-15', 'landscape is checked on the standard size');
	await page.setViewportSize({ width: 734, height: 343 }); // Playwright's "iPhone 15 landscape"
	await signInAsFreshUser(page, baseURL, 'iphone-landscape');
	const seed = await seedIphoneData(page, uniqueSuffix());

	await open(page, '/time');
	await expect(page.getByTestId('time-entry-card').first()).toBeVisible();
	await expectNoSidewaysScroll(page);
	// The week strip scrolls away on a short screen instead of holding half of it
	const weekStrip = page.locator('div.sticky').filter({ has: page.getByTestId('week-today-button') });
	await expect(weekStrip).toHaveCSS('position', 'static');
	await iphoneScreenshot(page, testInfo, '20-landscape-week');

	// A modal taller than the screen scrolls inside itself, so Save can be reached
	await page.getByRole('button', { name: 'Add Entry', exact: true }).last().click();
	const dialog = page.getByRole('dialog');
	const dialogBox = await dialog.boundingBox();
	expect(dialogBox!.y, 'dialog top on screen').toBeGreaterThanOrEqual(0);
	expect(dialogBox!.y + dialogBox!.height, 'dialog bottom on screen').toBeLessThanOrEqual(343);
	const saveButton = dialog.getByRole('button', { name: 'Save' });
	await saveButton.scrollIntoViewIfNeeded();
	await expect(saveButton).toBeInViewport();
	await iphoneScreenshot(page, testInfo, '20b-landscape-add-entry');
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	await open(page, `/notes/${seed.contractId}/${seed.noteId}`);
	await expect(editor(page)).toContainText('Agenda for the kickoff');
	await expectNoSidewaysScroll(page);
	await iphoneScreenshot(page, testInfo, '21-landscape-note');
});
