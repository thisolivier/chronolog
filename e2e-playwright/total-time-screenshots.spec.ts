/**
 * Sprint 066-TR review screenshots of the Total time r1 layout, against the design pack crops in
 * docs/design/total-time-r1/images/crops/: the desktop modal (1280×800, chromium) and, on a phone
 * project, the results screen and the open contract sheet. Images go to
 * `sprintScreenshotDirectory('066-TR')`, or to TOTAL_TIME_SHOTS_DIR when set.
 *   PLAYWRIGHT_BASE_URL=... npx playwright test e2e-playwright/total-time-screenshots.spec.ts --project=chromium --project=iphone-15
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SHOTS_DIRECTORY = process.env.TOTAL_TIME_SHOTS_DIR ?? sprintScreenshotDirectory('066-TR');

/** Three clients with several contracts, two with time this week, one archived contract */
async function seedSample(page: Page) {
	await page.goto('/');
	await page.evaluate(async () => {
		const send = async (method: string, url: string, body: unknown) => {
			const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const pad = (value: number) => String(value).padStart(2, '0');
		const monday = new Date();
		monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
		const weekStart = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
		const client = async (name: string, shortCode: string, colorIndex: number) =>
			(await send('POST', '/api/clients', { name, shortCode, colorIndex })).client.id;
		const contract = async (clientId: string, name: string) => (await send('POST', '/api/contracts', { clientId, name, isActive: true })).contract.id;
		const amplitude = await client('Amplitude', 'AMP', 6);
		const easyJet = await client('EasyJet', 'EZY', 3);
		const virginMedia = await client('Virgin Media O2', 'VMO', 2);
		const nationalDebtRelief = await contract(amplitude, 'National Debt Relief');
		const dailyPay = await contract(amplitude, 'Daily Pay');
		for (const name of ['Hungryroot', 'Thmanyah', 'Rank Group']) await contract(amplitude, name);
		await contract(easyJet, 'Native App Onboarding');
		await contract(virginMedia, 'Experimentation 2025');
		const archived = await contract(virginMedia, 'Old Retainer');
		await send('PATCH', `/api/contracts/${archived}`, { archived: true });
		for (const duration of ['20m', '25m', '16m']) await send('POST', '/api/time-entries', { contractId: nationalDebtRelief, date: weekStart, duration });
		for (const duration of ['30m', '22m']) await send('POST', '/api/time-entries', { contractId: dailyPay, date: weekStart, duration });
	});
}

async function openWithTwoSelected(page: Page, isMobile: boolean) {
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('week-total').click();
	await expect(page.getByTestId('total-time-modal')).toBeVisible();
	if (isMobile) await page.getByTestId('total-time-contracts-row').click();
	await page.getByTestId('total-time-select-none').click();
	await page.getByRole('checkbox', { name: 'National Debt Relief' }).check();
	await page.getByRole('checkbox', { name: 'Daily Pay' }).check();
}

test('desktop Total time modal', async ({ page, baseURL, isMobile }) => {
	test.skip(isMobile, 'desktop shot');
	await page.setViewportSize({ width: 1280, height: 800 });
	await signInAsFreshUser(page, baseURL, 'total-time-shots');
	await seedSample(page);
	await openWithTwoSelected(page, false);
	await expect(page.getByTestId('total-time-value')).toHaveText('1h 53m');
	await page.screenshot({ path: path.join(SHOTS_DIRECTORY, 'desktop-modal.png') });
});

test('phone results and contract sheet @iphone', async ({ page, baseURL, isMobile }) => {
	test.skip(!isMobile, 'phone shots');
	await signInAsFreshUser(page, baseURL, 'total-time-shots-phone');
	await seedSample(page);
	await openWithTwoSelected(page, true);
	await expect(page.getByTestId('total-time-selected-count')).toHaveText('2 selected');
	await page.screenshot({ path: path.join(SHOTS_DIRECTORY, 'mobile-contract-sheet.png') });
	await page.getByTestId('total-time-sheet-done').click();
	await expect(page.getByTestId('total-time-value')).toHaveText('1h 53m');
	await page.screenshot({ path: path.join(SHOTS_DIRECTORY, 'mobile-results.png') });
});
