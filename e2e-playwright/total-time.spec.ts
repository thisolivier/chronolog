/**
 * Sprint 065-TT: the week total opens the Total time modal. It starts on the viewed week with every
 * active contract checked; None empties the selection; one contract's total matches the entries
 * seeded here; All time drops the bounds; Escape and Close shut it. On a phone (`@iphone`) the
 * modal fills the window with its header as the top bar. `chronolog total` reads the same totals.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signInAsFreshUser } from './fresh-user';

const CLI_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'chronolog.mjs');

function runCli(args: string[], environment: Record<string, string>) {
	return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
		execFile(process.execPath, [CLI_PATH, ...args], { env: { ...process.env, ...environment } }, (error, stdout, stderr) =>
			resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
	});
}

type TotalTimeSeed = { alphaId: string; betaId: string; gammaId: string; weekStart: string; weekEnd: string };

/** One client: Alpha (90 min this week, 60 min in 2025), Beta (45 min this week), Gamma inactive and empty */
async function seedTotals(page: Page, suffix: string, extraContracts = 0): Promise<TotalTimeSeed> {
	await page.goto('/');
	return page.evaluate(async ({ suffix, extraContracts }) => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const pad = (value: number) => String(value).padStart(2, '0');
		const local = (moment: Date) => `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
		const monday = new Date();
		monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		const weekStart = local(monday);
		const clientId = (await post('/api/clients', { name: `Totals ${suffix}`, shortCode: `T${suffix.slice(-5).toUpperCase()}` })).client.id;
		const contract = async (name: string, isActive: boolean) => (await post('/api/contracts', { clientId, name, isActive })).contract.id;
		const alphaId = await contract('Alpha', true);
		const betaId = await contract('Beta', true);
		const gammaId = await contract('Gamma', false);
		await post('/api/time-entries', { contractId: alphaId, date: weekStart, duration: '1h 30m' });
		await post('/api/time-entries', { contractId: alphaId, date: '2025-03-03', duration: '1h' });
		await post('/api/time-entries', { contractId: betaId, date: weekStart, duration: '45m' });
		for (let index = 1; index <= extraContracts; index += 1) await contract(`Extra ${index}`, true);
		return { alphaId, betaId, gammaId, weekStart, weekEnd: local(sunday) };
	}, { suffix, extraContracts });
}

async function openTotalTime(page: Page) {
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('week-total').click();
	const modal = page.getByTestId('total-time-modal');
	await expect(modal).toBeVisible();
	return modal;
}

test('week total opens Total time: defaults, None, one contract, All time, close', async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'total-time');
	const seed = await seedTotals(page, Date.now().toString(36));
	const modal = await openTotalTime(page);

	// Default: the viewed (current) week, every contract checked (inactive too)
	await expect(page.getByTestId('total-time-from')).toHaveValue(seed.weekStart);
	await expect(page.getByTestId('total-time-to')).toHaveValue(seed.weekEnd);
	await expect(page.getByTestId('total-time-preset-this-week')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId(`total-time-contract-${seed.alphaId}`)).toBeChecked();
	await expect(page.getByTestId(`total-time-contract-${seed.betaId}`)).toBeChecked();
	await expect(page.getByTestId(`total-time-contract-${seed.gammaId}`)).toBeChecked();
	await expect(page.getByTestId('total-time-value')).toHaveText('2h 15m');
	await expect(page.getByTestId('total-time-entry-count')).toHaveText('2 entries');
	// The breakdown starts closed; one tap opens it
	await expect(page.getByTestId('total-time-row').first()).toBeHidden();
	await page.getByText('By contract (2)').click();
	await expect(page.getByTestId('total-time-row')).toHaveCount(2);
	await expect(page.getByTestId('total-time-row').first()).toBeVisible();
	await expect(page.getByTestId('total-time-row').first()).toHaveAttribute('data-contract-id', seed.alphaId);

	// None, then just Alpha
	await page.getByTestId('total-time-select-none').click();
	await expect(page.getByTestId('total-time-message')).toHaveText('No contracts selected');
	await page.getByTestId(`total-time-contract-${seed.alphaId}`).check();
	await expect(page.getByTestId('total-time-value')).toHaveText('1h 30m');
	await expect(page.getByTestId('total-time-entry-count')).toHaveText('1 entry');

	// All time: one tap clears both bounds and counts the 2025 entry
	await page.getByTestId('total-time-preset-all-time').click();
	await expect(page.getByTestId('total-time-from')).toHaveValue('');
	await expect(page.getByTestId('total-time-to')).toHaveValue('');
	await expect(page.getByTestId('total-time-preset-all-time')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('total-time-value')).toHaveText('2h 30m');

	// A range with nothing in it
	await page.getByTestId('total-time-from').fill('2024-01-01');
	await page.getByTestId('total-time-to').fill('2024-12-31');
	await expect(page.getByTestId('total-time-message')).toHaveText('No time recorded');

	// Close returns focus to the week total; Escape closes too
	await modal.getByTestId('total-time-close').click();
	await expect(modal).toBeHidden();
	await expect(page.getByTestId('week-total')).toBeFocused();
	await page.getByTestId('week-total').click();
	await expect(modal).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(modal).toBeHidden();
});

test('the modal opens on the week total, inactive and archived contracts included', async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'total-time-archived');
	const seed = await seedTotals(page, Date.now().toString(36));
	const archivedId = await page.evaluate(async ({ gammaId, alphaId, weekStart }) => {
		const send = async (method: string, url: string, body: unknown) => {
			const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const clientId = (await (await fetch(`/api/contracts-by-client`)).json()).contracts.find((contract: { id: string }) => contract.id === alphaId).clientId;
		const archived = (await send('POST', '/api/contracts', { clientId, name: 'Delta', isActive: true })).contract.id;
		await send('POST', '/api/time-entries', { contractId: gammaId, date: weekStart, duration: '2h' });
		await send('POST', '/api/time-entries', { contractId: archived, date: weekStart, duration: '33m' });
		await send('PATCH', `/api/contracts/${archived}`, { archived: true });
		return archived;
	}, seed);

	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	// 1h30 + 45m + 2h (inactive) + 33m (archived)
	await expect(page.getByTestId('week-total')).toHaveText('4h 48m');
	await page.getByTestId('week-total').click();
	await expect(page.getByTestId('total-time-value')).toHaveText('4h 48m');
	await expect(page.getByTestId('total-time-entry-count')).toHaveText('4 entries');

	// Inactive and archived together behind one closed toggle, each marked, both ticked
	const hidden = page.getByTestId('total-time-inactive');
	await expect(hidden.locator('summary')).toHaveText('Show inactive and archived (2)');
	await hidden.locator('summary').click();
	await expect(page.getByTestId(`total-time-contract-${archivedId}`)).toBeChecked();
	await expect(page.getByTestId(`total-time-contract-${seed.gammaId}`)).toBeChecked();
	await expect(hidden.getByTestId('total-time-contract-status')).toHaveText(['inactive', 'archived']);

	// Unticking the archived one drops its 33m
	await page.getByTestId(`total-time-contract-${archivedId}`).uncheck();
	await expect(page.getByTestId('total-time-value')).toHaveText('4h 15m');
});

test('opened from an earlier week, the viewed week is the default range', async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'total-time-week');
	const seed = await seedTotals(page, Date.now().toString(36));
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Previous week' }).click();
	await page.getByTestId('week-total').click();
	await expect(page.getByTestId('total-time-preset-viewed-week')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('total-time-from')).not.toHaveValue(seed.weekStart);
	await expect(page.getByTestId('total-time-message')).toHaveText('No time recorded');
	// A backdrop click closes it
	await page.getByTestId('total-time-backdrop').click({ position: { x: 5, y: 5 } });
	await expect(page.getByTestId('total-time-modal')).toBeHidden();
});

test('phone: Total time fills the window with a top bar @iphone', async ({ page, baseURL, isMobile }) => {
	test.skip(!isMobile, 'iPhone projects only');
	await signInAsFreshUser(page, baseURL, 'total-time-phone');
	// Enough contracts that the list runs well past the screen: the total must still be in view
	const seed = await seedTotals(page, Date.now().toString(36), 10);
	const modal = await openTotalTime(page);

	const viewport = page.viewportSize()!;
	const box = (await modal.boundingBox())!;
	expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
	expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(1);
	expect(Math.abs(box.height - viewport.height)).toBeLessThanOrEqual(2);

	// The header is the top bar: title left, Close right, both at the top
	const titleBox = (await modal.getByRole('heading', { name: 'Total time' }).boundingBox())!;
	const closeBox = (await modal.getByTestId('total-time-close').boundingBox())!;
	expect(titleBox.y).toBeLessThan(60);
	expect(closeBox.y).toBeLessThan(60);
	expect(closeBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
	expect(closeBox.height).toBeGreaterThanOrEqual(44);

	await expect(page.getByTestId('total-time-value')).toHaveText('2h 15m');
	// The total sits under the date range, fully inside the viewport on open (no scrolling)
	const totalBox = (await page.getByTestId('total-time-value').boundingBox())!;
	expect(totalBox.y).toBeGreaterThanOrEqual(0);
	expect(totalBox.x).toBeGreaterThanOrEqual(0);
	expect(totalBox.y + totalBox.height).toBeLessThanOrEqual(viewport.height);
	expect(totalBox.x + totalBox.width).toBeLessThanOrEqual(viewport.width);
	// All and None are in view on open too (the breakdown is collapsed), and touch-sized
	for (const testId of ['total-time-select-all', 'total-time-select-none']) {
		const buttonBox = (await page.getByTestId(testId).boundingBox())!;
		expect(buttonBox.y, testId).toBeGreaterThan(totalBox.y);
		expect(buttonBox.y + buttonBox.height, testId).toBeLessThanOrEqual(viewport.height);
		expect(buttonBox.height, testId).toBeGreaterThanOrEqual(44);
	}
	expect((await page.getByTestId('total-time-preset-all-time').boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await page.getByTestId('total-time-select-none').tap();
	await page.getByTestId(`total-time-contract-${seed.betaId}`).scrollIntoViewIfNeeded();
	await page.getByTestId(`total-time-contract-${seed.betaId}`).tap();
	await page.getByTestId('total-time-value').scrollIntoViewIfNeeded();
	await expect(page.getByTestId('total-time-value')).toHaveText('45m');
	// No sideways scroll inside the sheet
	const overflow = await modal.evaluate((element) => element.scrollWidth - element.clientWidth);
	expect(overflow).toBeLessThanOrEqual(0);

	await modal.getByTestId('total-time-close').tap();
	await expect(modal).toBeHidden();
});

test('chronolog total sums the same entries for contracts, clients and ranges', async ({ page, baseURL, isMobile }) => {
	test.skip(isMobile, 'CLI check runs once, on desktop projects');
	await signInAsFreshUser(page, baseURL, 'total-time-cli');
	const suffix = Date.now().toString(36);
	await seedTotals(page, suffix);
	const rawToken = await page.evaluate(async () => {
		const response = await fetch('/api/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'playwright 065' }) });
		return (await response.json()).rawToken as string;
	});
	const environment = {
		CHRONOLOG_BASE_URL: baseURL!.replace(/\/+$/, ''),
		CHRONOLOG_API_TOKEN: rawToken,
		CHRONOLOG_CONFIG: path.join(mkdtempSync(path.join(tmpdir(), 'chronolog-pw-065-')), 'config.json')
	};

	const allTime = await runCli(['total', '--all-contracts', '--all-time', '--json'], environment);
	expect(allTime.exitCode, allTime.stderr).toBe(0);
	const allTimeJson = JSON.parse(allTime.stdout);
	expect(allTimeJson).toMatchObject({ totalMinutes: 195, entryCount: 3, range: { from: null, to: null }, selection: 'all' });
	expect(allTimeJson.contracts).toHaveLength(2);

	const thisWeek = await runCli(['total', '--client', `Totals ${suffix}`], environment);
	expect(thisWeek.exitCode, thisWeek.stderr).toBe(0);
	expect(thisWeek.stdout).toMatch(/^Total 2h15m \(2 entries\) · \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}\n {2}T\w+\/Alpha +1h30m {2}\(1\)\n {2}T\w+\/Beta +45m {2}\(1\)\n$/);

	const lastYear = await runCli(['total', '--contract', 'Alpha', '--from', '2025-01-01', '--to', '2025-12-31', '--json'], environment);
	expect(JSON.parse(lastYear.stdout)).toMatchObject({ totalMinutes: 60, entryCount: 1 });

	expect((await runCli(['total', '--contract', 'Zeta'], environment)).exitCode).toBe(3);
	expect((await runCli(['total'], environment)).exitCode).toBe(2);
});
