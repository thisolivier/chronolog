/**
 * Sprint 064-DR (N1–N3) owner screenshots: the note editor header repeat, the notes list header and
 * linked time, on desktop 1280 × 800 (chromium) and the phone (iphone-15). Files are named
 * `n1-…`, `n2-…`, `n3-…` with a `-before` / `-after` suffix: `SPRINT_064_PHASE=before` names the
 * images of a run against the code before the sprint (default `after`). With
 * `UPDATE_SPRINT_SCREENSHOTS=1` they go to docs/review/screenshots/sprint-064-DR/.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { openSeededNote, seedNotesPolish } from './notes-polish-seed';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-064-DR');
const PHASE = process.env.SPRINT_064_PHASE === 'before' ? 'before' : 'after';

async function shot(page: Page, name: string, target?: Locator) {
	await page.waitForTimeout(300);
	await (target ?? page).screenshot({ path: path.join(SCREENSHOTS, `${name}-${PHASE}.png`) });
}

const unlinkButtons = (page: Page) => page.getByTestId('linked-time-entries').getByRole('button', { name: 'Unlink time entry' });

test('desktop: editor header, list headers and linked time', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'chromium only');
	await page.setViewportSize({ width: 1280, height: 800 });
	await signInAsFreshUser(page, baseURL, 'qa-064-shots');
	const seed = await seedNotesPolish(page);
	await openSeededNote(page, seed);
	await expect(page.getByTestId('linked-time-entry')).toHaveCount(2);
	await shot(page, 'n1-desktop-notes-page');
	await shot(page, 'n1-desktop-editor-header', page.getByTestId('note-editor-header'));
	await shot(page, 'n2-desktop-list-header-notes', page.getByTestId('note-list-header'));
	await shot(page, 'n3-desktop-linked-time', page.getByTestId('linked-time-entries'));
	if (PHASE === 'after') {
		await page.getByTestId('linked-time-entry').first().hover();
		await unlinkButtons(page).first().click();
		await shot(page, 'n3-desktop-unlink-confirm', page.getByTestId('linked-time-entries'));
		await page.keyboard.press('Escape');
	}

	// The sidebar hidden: the list header names the contract (title rows kept)
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();
	await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'contract');
	await shot(page, 'n2-desktop-list-header-contract', page.getByTestId('note-list-header'));
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();

	// A client's notes: the New note button opens its menu
	await page.goto(`/notes/client/${seed.clientId}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'client');
	await shot(page, 'n2-desktop-list-header-client', page.getByTestId('note-list-header'));
	await page.getByRole('button', { name: 'New note', exact: true }).click();
	await expect(page.getByTestId('new-note-contract-menu')).toBeVisible();
	await shot(page, 'n2-desktop-client-new-note-menu');
});

test('phone: list header and linked time @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'iphone-15', 'iphone-15 only');
	await signInAsFreshUser(page, baseURL, 'qa-064-phone-shots');
	const seed = await seedNotesPolish(page);
	await page.goto(`/notes/${seed.contractId}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('note-list-row')).toHaveCount(2);
	await shot(page, 'n2-phone-notes-list');
	await openSeededNote(page, seed);
	await shot(page, 'n1-phone-note-editor');
	const linked = page.getByTestId('linked-time-entries');
	await linked.scrollIntoViewIfNeeded();
	await shot(page, 'n3-phone-linked-time', linked);
	if (PHASE === 'after') {
		await unlinkButtons(page).first().tap();
		await shot(page, 'n3-phone-unlink-confirm', linked);
	}
});
