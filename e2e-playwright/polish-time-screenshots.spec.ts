/**
 * Sprint 064-DR review screenshots for the timesheet and timer items (T1–T4): the day heading bar
 * edge to edge, entry times aligned with the day total, no running light, the contract picked from
 * the timer's heading. Desktop 1280 × 800 in chromium, the phone from the iphone-15 project.
 * `SPRINT_064_PHASE=before` names the files `*-before.png` (taken on the pre-sprint code); the
 * default is `after`. `UPDATE_SPRINT_SCREENSHOTS=1` writes them into
 * docs/review/screenshots/sprint-064-DR/ (sprint-screenshots.ts).
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';
import { seedCheckpointBc, startTimerEarlier } from './checkpoint-bc-seed';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-064-DR');
const PHASE = process.env.SPRINT_064_PHASE === 'before' ? 'before' : 'after';
const isAfter = PHASE === 'after';

async function open(page: Page, target: string) {
	await page.goto(target);
	await page.waitForLoadState('networkidle');
}

async function shot(page: Page, name: string, target?: Locator) {
	const file = path.join(SCREENSHOTS, `${name}-${PHASE}.png`);
	if (target) await target.screenshot({ path: file });
	else await page.screenshot({ path: file });
}

const sidebarWidget = (page: Page) => page.getByTestId('timer-widget-sidebar');

test.describe('desktop 1280 × 800', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('timesheet and timer', async ({ page, baseURL }, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium', 'chromium only');
		test.setTimeout(90_000);
		await signInAsFreshUser(page, baseURL, 'polish-time-shots');
		const data = await seedCheckpointBc(page);

		// T1 / T2: the timesheet with today's heading pinned at the top
		await open(page, '/time');
		await expect(page.getByTestId('day-heading').first()).toBeVisible();
		await shot(page, 'T1-T2-desktop-timesheet');
		// Today's section across the scroller's full width (the bar now overhangs the section)
		const todaySection = page.locator(`section[data-day="${data.today}"]`);
		await page.getByRole('button', { name: `Go to ${data.today}` }).click();
		await expect.poll(async () => (await todaySection.boundingBox())?.y ?? 9999).toBeLessThan(700);
		await page.waitForTimeout(400);
		const sectionBox = (await todaySection.boundingBox())!;
		const scrollerBox = (await page.getByTestId('timesheet-scroll').boundingBox())!;
		await page.screenshot({
			path: path.join(SCREENSHOTS, `T1-T2-desktop-today-close-up-${PHASE}.png`),
			clip: { x: scrollerBox.x, y: sectionBox.y, width: scrollerBox.width, height: Math.min(sectionBox.height, 800 - sectionBox.y) }
		});

		// T3 / T4: a running timer with no contract (started from the timesheet)
		await sidebarWidget(page).getByRole('button', { name: 'Start Timer' }).click();
		await expect(sidebarWidget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await shot(page, 'T3-T4-desktop-timer-no-contract', sidebarWidget(page));
		if (isAfter) {
			await sidebarWidget(page).getByTestId('timer-select-contract').click();
			await expect(page.getByTestId('timer-contract-menu')).toBeVisible();
			await shot(page, 'T4-desktop-select-menu-open');
			await page.keyboard.press('Escape');
		}
		await sidebarWidget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await sidebarWidget(page).getByRole('button', { name: 'Discard', exact: true }).click();
		await expect(sidebarWidget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();

		// A running timer with a contract
		await startTimerEarlier(page, data.hungryrootId, 24, 'Follow-up notes');
		await open(page, '/time');
		await expect(sidebarWidget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await shot(page, 'T3-T4-desktop-timer-with-contract', sidebarWidget(page));
		if (isAfter) {
			await sidebarWidget(page).getByTestId('timer-change-contract').click();
			await expect(page.getByTestId('timer-contract-menu')).toBeVisible();
			await shot(page, 'T4-desktop-change-menu-open');
			await page.keyboard.press('Escape');
		}
		// Hidden sidebar: the header pill (T3)
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(page.getByTestId('timer-indicator')).toBeVisible();
		await shot(page, 'T3-desktop-header-pill', page.getByTestId('timer-indicator'));
	});
});

test('phone: timesheet and capture screen @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'iphone-15', 'iphone-15 only');
	test.setTimeout(90_000);
	await signInAsFreshUser(page, baseURL, 'polish-time-phone');
	const data = await seedCheckpointBc(page);

	await open(page, '/time');
	await expect(page.getByTestId('day-heading').first()).toBeVisible();
	await shot(page, 'T1-T2-phone-timesheet');

	// The phone's first screen holds the timer widget: start one with no contract
	await open(page, '/');
	const phoneWidget = page.locator('[data-testid^="timer-widget-"]').first();
	await phoneWidget.getByRole('button', { name: 'Start Timer' }).click();
	await expect(phoneWidget.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
	await shot(page, 'T3-T4-phone-timer-no-contract');
	if (isAfter) {
		await phoneWidget.getByTestId('timer-select-contract').click();
		await expect(page.getByTestId('timer-contract-menu')).toBeVisible();
		await shot(page, 'T4-phone-select-menu-open');
		await page.getByTestId('timer-contract-menu').getByRole('menuitemradio', { name: 'Amplitude / Hungryroot' }).click();
		await expect(phoneWidget.getByTestId('timer-identity').getByTestId('contract-mark')).toBeVisible();
	} else {
		// The pre-064-DR running panel's contract select
		await phoneWidget.locator('#draft-contract').selectOption(data.hungryrootId);
	}
	await expect.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null)).not.toBeNull();

	// The header pill on a note screen, then the capture screen it opens
	await open(page, '/time');
	await expect(page.getByTestId('timer-indicator')).toBeVisible();
	await shot(page, 'T3-phone-header-pill');
	await page.getByTestId('timer-indicator').click();
	await expect(page.getByTestId('phone-capture-screen')).toBeVisible();
	await shot(page, 'T3-T4-phone-capture-screen-with-contract');
	if (isAfter) {
		await page.getByTestId('timer-widget-screen').getByTestId('timer-change-contract').click();
		await expect(page.getByTestId('timer-contract-menu')).toBeVisible();
		await shot(page, 'T4-phone-capture-screen-change-menu-open');
	}
});
