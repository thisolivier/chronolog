/**
 * Checkpoint B/C owner screenshots (design r1, stages 4–7). Off by default; writes into
 * docs/review/screenshots/checkpoint-bc/ with
 *   CHECKPOINT_SCREENSHOTS=1 npx playwright test e2e-playwright/checkpoint-bc-screenshots.spec.ts --project=chromium --project=iphone-15
 * The last test shoots the notes list and timesheet at 320×568 (iphone-15 project).
 * SCREENSHOTS_DIR=sprint-060/checkpoint-bc writes into another folder under docs/review/screenshots/ instead.
 * Desktop shots run in chromium at 1280×800, phone shots in the iphone-15 project at 390×844.
 * Seed: checkpoint A's names (Amplitude: Hungryroot / Daily Pay / Rank Group; EasyJet; Internal)
 * plus an ontology and a week of entries (checkpoint-bc-seed.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInAsFreshUser } from './fresh-user';
import { editor } from './notes-helpers';
import { seedCheckpointBc, startTimerEarlier, type CheckpointBcSeed } from './checkpoint-bc-seed';

const OUTPUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'review', 'screenshots', process.env.SCREENSHOTS_DIR ?? 'checkpoint-bc');
const enabled = process.env.CHECKPOINT_SCREENSHOTS === '1';
const widget = (page: Page) => page.getByTestId('timer-widget-sidebar');

async function shot(page: Page, name: string) {
	await page.waitForTimeout(400);
	await page.screenshot({ path: path.join(OUTPUT, name) });
}

async function desktopSetup(page: Page, baseURL: string | undefined, label: string, testInfo: { project: { name: string } }): Promise<CheckpointBcSeed> {
	test.skip(!enabled || testInfo.project.name !== 'chromium', 'CHECKPOINT_SCREENSHOTS=1, chromium only');
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1280, height: 800 });
	await signInAsFreshUser(page, baseURL, label);
	return seedCheckpointBc(page);
}

async function openTime(page: Page) {
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('time-entry-card').first()).toBeVisible();
}

test('desktop: week, inline edit, completion form', async ({ page, baseURL }, testInfo) => {
	const data = await desktopSetup(page, baseURL, 'bc-shots-week', testInfo);
	await openTime(page);
	// Mid-scroll through Wednesday: its heading is pinned under the week strip
	const wednesday = new Date(`${data.monday}T12:00:00`);
	wednesday.setDate(wednesday.getDate() + 2);
	const pad = (value: number) => String(value).padStart(2, '0');
	const wednesdayDate = `${wednesday.getFullYear()}-${pad(wednesday.getMonth() + 1)}-${pad(wednesday.getDate())}`;
	await page.getByTestId('timesheet-scroll').evaluate((scroller, date) => {
		const section = scroller.querySelector<HTMLElement>(`[data-day="${date}"]`);
		if (!section) return;
		const offset = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
		scroller.scrollTo({ top: offset + 70, behavior: 'auto' });
	}, wednesdayDate);
	await shot(page, 'desktop-01-week-sticky-day-heading.png');

	const cueRow = page.locator(`[data-entry-id="${data.cueEntryId}"]`);
	await cueRow.getByTestId('missing-detail-cue').click();
	await expect(cueRow.getByTestId('cascade-deliverable')).toHaveAttribute('data-cascade-state', 'ready');
	await cueRow.getByTestId('cascade-deliverable').locator('select').selectOption({ label: 'Event pipeline' });
	await expect(cueRow.getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', 'ready');
	await shot(page, 'desktop-02-inline-edit-classification.png');
	await cueRow.getByRole('button', { name: 'Done' }).click();

	await startTimerEarlier(page, data.hungryrootId, 52, 'Event taxonomy review');
	await openTime(page);
	await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
	await expect(widget(page).getByRole('button', { name: 'Save', exact: true })).toBeVisible();
	await shot(page, 'desktop-03-just-stopped-completion-form.png');
});

test('desktop: split overlay', async ({ page, baseURL }, testInfo) => {
	const data = await desktopSetup(page, baseURL, 'bc-shots-split', testInfo);
	await startTimerEarlier(page, data.hungryrootId, 95, `Event taxonomy review [[${data.longNoteId}]]`);
	await openTime(page);
	await widget(page).getByTestId('timer-split-button').click();
	const leftCard = page.getByTestId('split-card-left');
	await expect(page.getByTestId('split-overlay')).toBeVisible();
	await expect(leftCard.locator('#split-left-contract')).toBeEnabled();
	await shot(page, 'desktop-04-split-overlay-fresh.png');

	await page.getByRole('button', { name: 'Flip' }).click();
	await leftCard.locator('#split-left-description').fill('Pricing review call');
	await leftCard.locator('#split-left-contract').selectOption({ label: 'Amplitude / Rank Group' });
	await leftCard.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(leftCard.getByTestId('split-left-summary')).toBeVisible();
	await shot(page, 'desktop-05-split-after-left-save.png');
});

test('desktop: search and pickers', async ({ page, baseURL }, testInfo) => {
	const data = await desktopSetup(page, baseURL, 'bc-shots-search', testInfo);
	await startTimerEarlier(page, data.hungryrootId, 20, 'Event taxonomy review');
	await page.goto('/search?q=pricing');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('search-hit-note').first()).toBeVisible();
	await page.getByTestId('global-search-input').blur();
	await shot(page, 'desktop-06-search-results.png');

	// No Enter: in Chromium an Enter here can send the caret to the top of the note (2026-11-08 review)
	await page.goto(`/notes/${data.rankGroupId}/${data.rankGroupNoteId}`);
	await page.waitForLoadState('networkidle');
	await expect(editor(page)).toContainText('Tiered pricing options');
	await expect
		.poll(async () => {
			await editor(page).getByText('Tiered pricing options').click();
			await page.keyboard.press('End');
			return page.evaluate(() => Boolean(window.getSelection()?.anchorNode?.parentElement?.closest('[data-note-editor-content]')));
		})
		.toBe(true);
	await page.keyboard.type(' See [[');
	await expect(page.getByTestId('link-picker')).toHaveAttribute('data-status', 'ready');
	await shot(page, 'desktop-07-picker-in-editor.png');
	await page.keyboard.press('Escape');

	await openTime(page);
	await page.locator(`[data-add-entry="${data.today}"]`).click();
	await page.keyboard.type('Answered [[pay');
	await expect(page.getByTestId('link-picker').getByTestId('link-picker-option').first()).toBeVisible();
	await shot(page, 'desktop-08-picker-in-entry-description.png');
});

test('iPhone 390×844 @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(!enabled || testInfo.project.name !== 'iphone-15', 'CHECKPOINT_SCREENSHOTS=1, iphone-15 only');
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 390, height: 844 });
	await signInAsFreshUser(page, baseURL, 'bc-shots-phone');
	const data = await seedCheckpointBc(page);

	await openTime(page);
	// The phone opens on today; the week reads from Monday
	await page.getByRole('button', { name: `Go to ${data.monday}` }).click();
	await page.waitForTimeout(300);
	await shot(page, 'phone-01-time-review-week.png');

	await page.getByRole('button', { name: `Go to ${data.today}` }).click();
	await page.waitForTimeout(300);
	await shot(page, 'phone-02-day-with-entries.png');

	await startTimerEarlier(page, data.hungryrootId, 38, 'Event taxonomy review');
	await openTime(page);
	await page.getByTestId('timer-indicator').click();
	const screen = page.getByTestId('phone-capture-screen');
	await expect(screen.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
	await shot(page, 'phone-03-capture-running.png');

	await screen.getByRole('button', { name: 'Stop', exact: true }).click();
	await expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
	await shot(page, 'phone-04-capture-stopped.png');
	await screen.getByTestId('capture-screen-back').click();

	await page.goto('/search?q=pricing');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('search-hit-note').first()).toBeVisible();
	await page.getByTestId('global-search-input').blur();
	await shot(page, 'phone-05-search.png');
});

test('iPhone 320 wide @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(!enabled || testInfo.project.name !== 'iphone-15', 'CHECKPOINT_SCREENSHOTS=1, iphone-15 only');
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 320, height: 568 });
	await signInAsFreshUser(page, baseURL, 'bc-shots-320');
	const data = await seedCheckpointBc(page);

	await page.goto(`/notes/${data.hungryrootId}`);
	await expect(page.getByTestId('note-list-row').first()).toBeVisible();
	await shot(page, 'phone320-01-notes-list.png');

	await openTime(page);
	await page.getByRole('button', { name: `Go to ${data.today}` }).click();
	await page.waitForTimeout(300);
	await shot(page, 'phone320-02-timesheet.png');
});
