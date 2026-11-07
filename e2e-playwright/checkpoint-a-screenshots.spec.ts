/**
 * Checkpoint A owner screenshots (design r1). Off by default; writes into
 * docs/review/screenshots/checkpoint-a/ with
 *   CHECKPOINT_SCREENSHOTS=1 npx playwright test e2e-playwright/checkpoint-a-screenshots.spec.ts --project=chromium --project=iphone-15
 * SCREENSHOTS_DIR=sprint-060/checkpoint-a writes into another folder under docs/review/screenshots/ instead.
 * Desktop shots run in chromium at 1280×800, phone shots in the iphone-15 project at 390×844.
 * Seeds the mock-up names (Amplitude: Hungryroot, Daily Pay, Rank Group; EasyJet; Internal).
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInAsFreshUser } from './fresh-user';
import { editor } from './notes-helpers';
import { seedCheckpoint } from './checkpoint-a-seed';

const OUTPUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'review', 'screenshots', process.env.SCREENSHOTS_DIR ?? 'checkpoint-a');
const enabled = process.env.CHECKPOINT_SCREENSHOTS === '1';
const widget = (page: Page) => page.getByTestId('timer-widget-sidebar');

/** Start a timer on the contract 47 minutes ago, as the owner would see it mid-session */
async function startTimerEarlier(page: Page, contractId: string, description: string) {
	await page.evaluate(
		async ({ contractId, description }) => {
			const started = new Date(Date.now() - 47 * 60_000);
			const pad = (value: number) => String(value).padStart(2, '0');
			const date = `${started.getFullYear()}-${pad(started.getMonth() + 1)}-${pad(started.getDate())}`;
			const startTime = `${pad(started.getHours())}:${pad(started.getMinutes())}`;
			const response = await fetch('/api/timer/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, date, startTime, confirmed: true, description })
			});
			if (!response.ok) throw new Error(`start: ${response.status} ${await response.text()}`);
		},
		{ contractId, description }
	);
}

async function shot(page: Page, name: string) {
	await page.waitForTimeout(400);
	await page.screenshot({ path: path.join(OUTPUT, name) });
}

test('desktop 1280×800', async ({ page, baseURL }, testInfo) => {
	test.skip(!enabled || testInfo.project.name !== 'chromium', 'CHECKPOINT_SCREENSHOTS=1, chromium only');
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1280, height: 800 });
	await signInAsFreshUser(page, baseURL, 'checkpoint-a-shots');
	const data = await seedCheckpoint(page);
	await startTimerEarlier(page, data.hungryrootId, 'Event taxonomy review');
	await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
	await expect(editor(page)).toBeVisible();
	await expect(widget(page).getByTestId('timer-identity-contract')).toHaveText('Hungryroot');
	await widget(page).locator('#draft-description').fill('Event taxonomy review');
	await page.locator('body').click({ position: { x: 640, y: 400 } });
	await shot(page, 'desktop-01-notes-three-columns-timer-expanded.png');

	await widget(page).getByTestId('timer-collapse-toggle').click();
	await expect(widget(page).getByTestId('timer-compact')).toBeVisible();
	await shot(page, 'desktop-02-notes-timer-collapsed.png');
	await widget(page).getByTestId('timer-collapse-toggle').click();

	await page.getByTestId('note-editor-header').getByRole('button', { name: 'Note actions' }).click();
	await expect(page.getByRole('menu', { name: 'Note actions' })).toBeVisible();
	await shot(page, 'desktop-03-note-actions-menu.png');
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'Toggle sidebar' }).click();
	await expect(page.getByTestId('timer-indicator')).toBeVisible();
	await shot(page, 'desktop-04-sidebar-hidden-header-pill.png');
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();

	await page.goto('/notes/all');
	await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'all');
	await page.getByTestId('note-list-row').filter({ hasText: 'Pricing review' }).click();
	await expect(editor(page)).toBeVisible();
	await shot(page, 'desktop-05-all-notes.png');

	await page.goto('/time');
	await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
	await expect(widget(page)).toContainText('Finish entry');
	await shot(page, 'desktop-06-time-entries-finish-entry.png');
});

test('iPhone 390×844 @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(!enabled || testInfo.project.name !== 'iphone-15', 'CHECKPOINT_SCREENSHOTS=1, iphone-15 only');
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 390, height: 844 });
	await signInAsFreshUser(page, baseURL, 'checkpoint-a-phone');
	const data = await seedCheckpoint(page);

	await page.goto(`/notes/${data.hungryrootId}`);
	await expect(page.getByTestId('note-list-row').first()).toBeVisible();
	await shot(page, 'phone-01-notes-list.png');

	await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
	await expect(editor(page)).toBeVisible();
	await shot(page, 'phone-02-note-toolbar.png');

	await startTimerEarlier(page, data.hungryrootId, 'Event taxonomy review');
	await page.goto(`/notes/${data.rankGroupId}/${data.rankGroupNoteId}`);
	await expect(page.getByTestId('timer-indicator')).toBeVisible();
	await shot(page, 'phone-03-note-running-pill.png');

	await page.getByRole('button', { name: 'Formatting' }).click();
	await expect(page.getByRole('menu').first()).toBeVisible();
	await shot(page, 'phone-04-formatting-overflow.png');
});
