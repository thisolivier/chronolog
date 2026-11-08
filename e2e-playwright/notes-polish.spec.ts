/**
 * Sprint 064-DR (N1–N3), the owner's notes polish:
 * - N1: the editor header's contract repeat is no longer capped at ten tiles; it fills the row up
 *   to the actions (no repeat in the single-column phone layout).
 * - N2: with the sidebar beside the list (owner `notes`) the list header is one row: sort toggle,
 *   repeat, New note; title and count only for screen readers. `contract` / `client` / `all` keep
 *   their title rows. New note is icon only (no border or fill) everywhere and keeps its menu.
 * - N3: linked time has no heading; each row starts with a clock glyph; × asks "Unlink?" inline.
 * Each test signs up its own user. Screenshots: notes-polish-screenshots.spec.ts.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { signInAsFreshUser } from './fresh-user';
import { linkedEntryCount, openSeededNote, seedNotesPolish } from './notes-polish-seed';

const header = (page: Page) => page.getByTestId('note-list-header');
const newNoteButton = (page: Page) => page.getByRole('button', { name: 'New note', exact: true });
const unlinkButtons = (page: Page) => page.getByTestId('linked-time-entries').getByRole('button', { name: 'Unlink time entry' });
const box = async (locator: Locator) => (await locator.boundingBox())!;

/** Icon only: no border, no fill until hovered */
async function expectBorderless(button: Locator) {
	const style = await button.evaluate((element) => {
		const computed = getComputedStyle(element);
		return { border: computed.borderTopWidth, background: computed.backgroundColor };
	});
	expect(style.border).toBe('0px');
	expect(style.background).toBe('rgba(0, 0, 0, 0)');
}

test.describe('desktop 1280', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('N2: one-row list header beside the sidebar; title rows when the sidebar is hidden', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-064-header');
		const seed = await seedNotesPolish(page);
		await openSeededNote(page, seed);

		const context = page.getByTestId('note-list-context');
		await expect(context).toHaveAttribute('data-owner', 'notes');
		await expect(header(page)).toHaveAttribute('data-layout', 'one-row');
		// No visible title, eyebrow or count; screen readers still hear them
		await expect(context).toHaveClass(/sr-only/);
		await expect(page.getByTestId('note-list-eyebrow')).toHaveCount(0);
		await expect(page.getByTestId('note-list-title')).toHaveText('Notes');
		await expect(page.getByTestId('note-list-count')).toHaveText('2');
		await expect(page.getByTestId('note-list-context-sr')).toContainText(seed.contractName);
		await expect(page.getByRole('heading', { level: 2, name: new RegExp(`Notes.*${seed.contractName}`) })).toHaveCount(1);

		// Sort toggle at the left, the repeat filling the middle, New note at the right: one row
		const sortBox = await box(page.getByTestId('note-sort-toggle'));
		const repeatBox = await box(header(page).getByTestId('contract-tile-repeat'));
		const buttonBox = await box(newNoteButton(page));
		const middle = (rectangle: { y: number; height: number }) => rectangle.y + rectangle.height / 2;
		expect(Math.abs(middle(sortBox) - middle(buttonBox))).toBeLessThanOrEqual(2);
		expect(Math.abs(middle(repeatBox) - middle(buttonBox))).toBeLessThanOrEqual(2);
		expect(repeatBox.x).toBeGreaterThanOrEqual(sortBox.x + sortBox.width);
		expect(buttonBox.x - (repeatBox.x + repeatBox.width)).toBeLessThanOrEqual(8.5);
		expect(repeatBox.width).toBeGreaterThan(100);
		// The same height as the editor header beside it
		const listHeaderHeight = (await box(header(page))).height;
		const editorHeaderHeight = (await box(page.getByTestId('note-editor-header'))).height;
		expect(Math.abs(listHeaderHeight - editorHeaderHeight)).toBeLessThanOrEqual(1);

		await expectBorderless(newNoteButton(page));
		expect(buttonBox.width).toBe(32);

		// The sort toggle still works
		await page.getByTestId('note-sort-toggle').click();
		await expect(page.getByTestId('note-sort-toggle')).toHaveText('Created ↓');
		await page.getByTestId('note-sort-toggle').click();

		// Sidebar hidden: the contract owns the header again, with the sort toggle on its own row
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(context).toHaveAttribute('data-owner', 'contract');
		await expect(header(page)).toHaveAttribute('data-layout', 'title-rows');
		await expect(page.getByTestId('note-list-title')).toHaveText(seed.contractName);
		await expect(page.getByTestId('note-list-eyebrow')).toHaveText(seed.clientName);
		await expect(page.getByTestId('note-list-count')).toBeVisible();
		const titleBox = await box(page.getByTestId('note-list-title'));
		expect((await box(page.getByTestId('note-sort-toggle'))).y).toBeGreaterThan(titleBox.y + titleBox.height - 1);

		// New note still starts a draft for the contract
		await newNoteButton(page).click();
		await expect(page.getByTestId('draft-note-row')).toBeVisible();
	});

	test('N2: client and all-notes views keep their titles; the borderless New note opens its menu', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-064-client');
		const seed = await seedNotesPolish(page);
		await page.goto(`/notes/client/${seed.clientId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'client');
		await expect(header(page)).toHaveAttribute('data-layout', 'title-rows');
		await expect(page.getByTestId('note-list-title')).toHaveText(seed.clientName);
		await expect(page.getByTestId('note-list-title')).toBeVisible();
		await expectBorderless(newNoteButton(page));
		await newNoteButton(page).click();
		const menu = page.getByTestId('new-note-contract-menu');
		await expect(menu.getByRole('menuitem')).toHaveCount(2);
		await expect(menu.getByRole('menuitem').first()).toBeFocused();
		await menu.getByRole('menuitem', { name: seed.contractName }).click();
		await expect(page.getByTestId('draft-note-row')).toBeVisible();

		await page.goto('/notes/all');
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'all');
		await expect(page.getByTestId('note-list-title')).toBeVisible();
		await expect(header(page).getByTestId('contract-tile-repeat')).toHaveCount(0);
		await newNoteButton(page).click();
		await expect(page.getByTestId('new-note-contract-menu').getByRole('menuitem', { name: new RegExp(seed.clientName) }).first()).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('new-note-contract-menu')).toHaveCount(0);
	});

	test('N1: the editor header repeat fills the row up to the actions', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-064-editor-repeat');
		const seed = await seedNotesPolish(page);
		await openSeededNote(page, seed);
		const editorHeader = page.getByTestId('note-editor-header');
		const repeatBox = await box(editorHeader.getByTestId('contract-tile-repeat'));
		const actionsBox = await box(editorHeader.getByRole('button', { name: 'Note actions' }));
		// Well past the old ten-tile cap (160 px), ending one row gap before the ellipsis
		expect(repeatBox.width).toBeGreaterThan(16 * 10 + 50);
		const trailingGap = actionsBox.x - (repeatBox.x + repeatBox.width);
		expect(trailingGap).toBeGreaterThanOrEqual(0);
		expect(trailingGap).toBeLessThanOrEqual(12.5);
	});

	test('N3: clock glyph, no heading, and an inline confirm before unlinking', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-064-unlink');
		const seed = await seedNotesPolish(page);
		await openSeededNote(page, seed);
		const linked = page.getByTestId('linked-time-entries');
		const rows = linked.getByTestId('linked-time-entry');
		await expect(rows).toHaveCount(2);
		// No "Linked time · N" heading (the rows' "Linked time entry" is screen-reader text)
		await expect(linked).not.toContainText('Linked time ·');
		await expect(linked.getByRole('heading')).toHaveCount(0);
		for (const row of await rows.all()) {
			await expect(row.getByTestId('linked-time-entry-clock')).toHaveAttribute('aria-hidden', 'true');
			await expect(row).toHaveAccessibleName(/^Linked time entry,/);
		}
		// The glyph comes before the date
		const clockBox = await box(rows.first().getByTestId('linked-time-entry-clock'));
		expect(clockBox.x + clockBox.width).toBeLessThanOrEqual((await box(rows.first().getByTestId('linked-time-entry-date'))).x);

		// × asks first; focus is on Unlink; Escape keeps the link and focus returns to ×
		await rows.first().hover();
		await unlinkButtons(page).first().click();
		const confirm = linked.getByTestId('unlink-confirm');
		await expect(confirm).toContainText('Unlink?');
		await expect(confirm.getByRole('button', { name: 'Unlink', exact: true })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(confirm).toHaveCount(0);
		await expect(rows).toHaveCount(2);
		await expect(unlinkButtons(page).first()).toBeFocused();

		// Cancel keeps it too
		await unlinkButtons(page).first().click();
		await confirm.getByRole('button', { name: 'Cancel' }).click();
		await expect(rows).toHaveCount(2);
		await expect(unlinkButtons(page).first()).toBeFocused();
		expect(await linkedEntryCount(page, seed.longNoteId)).toBe(2);

		// Keyboard: Enter on × opens the question, Enter on Unlink removes it; focus moves to the next row's ×
		await unlinkButtons(page).first().press('Enter');
		await expect(confirm.getByRole('button', { name: 'Unlink', exact: true })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(rows).toHaveCount(1);
		await expect(unlinkButtons(page).first()).toBeFocused();
		await expect.poll(() => linkedEntryCount(page, seed.longNoteId)).toBe(1);

		// The last one: the section goes away
		await unlinkButtons(page).first().click();
		await confirm.getByRole('button', { name: 'Unlink', exact: true }).click();
		await expect(linked).toHaveCount(0);
		await expect.poll(() => linkedEntryCount(page, seed.longNoteId)).toBe(0);
	});

	test('N3: the confirm works inside the short-screen "Links and attachments" disclosure', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-064-short');
		const seed = await seedNotesPolish(page);
		await page.setViewportSize({ width: 844, height: 390 });
		await openSeededNote(page, seed);
		const disclosure = page.getByTestId('note-linked-panels');
		await disclosure.locator('summary').click();
		const rows = page.getByTestId('linked-time-entry');
		await expect(rows).toHaveCount(2);
		await rows.first().hover();
		await unlinkButtons(page).first().click();
		await page.getByTestId('unlink-confirm').getByRole('button', { name: 'Cancel' }).click();
		await expect(rows).toHaveCount(2);
		await unlinkButtons(page).first().click();
		await page.getByTestId('unlink-confirm').getByRole('button', { name: 'Unlink', exact: true }).click();
		await expect(rows).toHaveCount(1);
	});
});

test.describe('phone', () => {
	test('N2 / N3 on the phone: title rows, a 44 px icon-only New note, tap to confirm unlinking @iphone', async ({ page, baseURL }, testInfo) => {
		test.skip(!testInfo.project.name.startsWith('iphone'), 'iPhone projects only');
		await signInAsFreshUser(page, baseURL, 'qa-064-phone');
		const seed = await seedNotesPolish(page);
		await page.goto(`/notes/${seed.contractId}`);
		await page.waitForLoadState('networkidle');
		// The phone never shows the sidebar beside the list, so the header names the contract
		await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'contract');
		await expect(header(page)).toHaveAttribute('data-layout', 'title-rows');
		await expect(page.getByTestId('note-list-title')).toHaveText(seed.contractName);
		await expectBorderless(newNoteButton(page));
		const buttonBox = await box(newNoteButton(page));
		expect(buttonBox.width).toBeGreaterThanOrEqual(44);
		expect(buttonBox.height).toBeGreaterThanOrEqual(44);

		// Single-column editor: still no repeat in its header
		await openSeededNote(page, seed);
		await expect(page.getByTestId('note-editor-header').getByTestId('contract-tile-repeat')).toHaveCount(0);

		const rows = page.getByTestId('linked-time-entry');
		await expect(rows).toHaveCount(2);
		await expect(rows.first().getByTestId('linked-time-entry-clock')).toBeVisible();
		await unlinkButtons(page).first().tap();
		const confirm = page.getByTestId('unlink-confirm');
		const unlinkBox = await box(confirm.getByRole('button', { name: 'Unlink', exact: true }));
		expect(unlinkBox.height).toBeGreaterThanOrEqual(44);
		await expect(confirm).toBeInViewport({ ratio: 1 });
		await confirm.getByRole('button', { name: 'Cancel' }).tap();
		await expect(rows).toHaveCount(2);
		await unlinkButtons(page).first().tap();
		await confirm.getByRole('button', { name: 'Unlink', exact: true }).tap();
		await expect(rows).toHaveCount(1);
		await expect.poll(() => linkedEntryCount(page, seed.longNoteId)).toBe(1);
	});
});
