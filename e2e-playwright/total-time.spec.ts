/**
 * Sprint 065-TT: the week total opens the Total time modal. It starts on the viewed week with every
 * active contract checked; None empties the selection; one contract's total matches the entries
 * seeded here; All time drops the bounds; Escape and Close shut it. `chronolog total` reads the
 * same totals.
 * Sprint 066-TR (approved r1 layout, docs/design/total-time-r1, acceptance A01..A22): desktop is a
 * bounded two-column modal (result left, Contracts right, the list scrolling inside); a phone
 * (`@iphone`) gets the full-window results screen with a Contracts row that opens a sheet over the
 * same live selection (Done and Escape only close it, sheet before modal).
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
	// A01: result and selector side by side; the breakdown starts open (TT-06)
	const resultBox = (await page.getByTestId('total-time-result').boundingBox())!;
	const panelBox = (await page.getByTestId('total-time-contracts-panel').boundingBox())!;
	expect(panelBox.x).toBeGreaterThan(resultBox.x + resultBox.width - 1);
	expect(panelBox.y).toBeLessThan(resultBox.y + resultBox.height);
	await expect(page.getByTestId('total-time-contracts-row')).toHaveCount(0);
	await expect(page.getByTestId('total-time-selected-count')).toHaveText(/^\d+ selected$/);
	await expect(page.getByTestId('total-time-row')).toHaveCount(2);
	await expect(page.getByTestId('total-time-row').first()).toBeVisible();
	await expect(page.getByTestId('total-time-row').first()).toHaveAttribute('data-contract-id', seed.alphaId);
	// The approved preset order, This week first on the current week
	const presetKeys = await modal.locator('[data-testid^="total-time-preset-"]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-testid')));
	expect(presetKeys).toEqual(['total-time-preset-this-week', 'total-time-preset-this-month', 'total-time-preset-this-year', 'total-time-preset-all-time']);

	// A06: None is a dash and "No contracts selected", no stale rows, no fallback to All
	await page.getByTestId('total-time-select-none').click();
	await expect(page.getByTestId('total-time-message')).toHaveText('No contracts selected');
	await expect(page.getByTestId('total-time-value')).toHaveText('–');
	await expect(page.getByTestId('total-time-row')).toHaveCount(0);
	await expect(page.getByTestId('total-time-selected-count')).toHaveText('0 selected');

	// A07: a contract with no time in range is a zero, "0 entries", and still counts as selected
	await page.getByTestId('total-time-inactive').locator('summary').click();
	await page.getByTestId(`total-time-contract-${seed.gammaId}`).check();
	await expect(page.getByTestId('total-time-value')).toHaveText('0h');
	await expect(page.getByTestId('total-time-entry-count')).toHaveText('0 entries');
	await expect(page.getByTestId('total-time-message')).toHaveText('No time recorded');
	await expect(page.getByTestId('total-time-selected-count')).toHaveText('1 selected');
	await expect(page.getByTestId(`total-time-contract-${seed.gammaId}`)).toBeChecked();
	await page.getByTestId(`total-time-contract-${seed.gammaId}`).uncheck();

	// The whole row is the label: a click on the contract's name ticks it
	await page.getByTestId('total-time-contracts-panel').getByText('Alpha', { exact: true }).click();
	await expect(page.getByTestId(`total-time-contract-${seed.alphaId}`)).toBeChecked();
	await expect(page.getByTestId('total-time-value')).toHaveText('1h 30m');
	await expect(page.getByTestId('total-time-entry-count')).toHaveText('1 entry');

	// A21: closing By contract sticks across filter updates
	await page.getByTestId('total-time-breakdown-toggle').click();
	await expect(page.getByTestId('total-time-breakdown-toggle')).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByTestId('total-time-row')).toBeHidden();
	await page.getByTestId(`total-time-contract-${seed.betaId}`).check();
	await expect(page.getByTestId('total-time-value')).toHaveText('2h 15m');
	await expect(page.getByTestId('total-time-breakdown-toggle')).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByTestId('total-time-row').first()).toBeHidden();
	await page.getByTestId('total-time-breakdown-toggle').click();
	await expect(page.getByTestId('total-time-row')).toHaveCount(2);
	await page.getByTestId(`total-time-contract-${seed.betaId}`).uncheck();

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

	// A09: separate fields with a gap; From after To marks both, keeps the typed values, shows no total
	const fromBox = (await page.getByTestId('total-time-from').boundingBox())!;
	const toBox = (await page.getByTestId('total-time-to').boundingBox())!;
	expect(toBox.x - (fromBox.x + fromBox.width)).toBeGreaterThanOrEqual(8);
	await page.getByTestId('total-time-from').fill('2024-12-31');
	await page.getByTestId('total-time-to').fill('2024-01-01');
	await expect(page.getByTestId('total-time-message')).toHaveText('From is after To');
	await expect(page.getByTestId('total-time-value')).toHaveText('–');
	await expect(page.getByTestId('total-time-from')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByTestId('total-time-to')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByTestId('total-time-from')).toHaveValue('2024-12-31');
	await page.getByTestId('total-time-to').fill('2025-12-31');
	await expect(page.getByTestId('total-time-from')).not.toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByTestId('total-time-value')).toHaveText('1h');

	// Close returns focus to the week total; Escape closes too
	await modal.getByTestId('total-time-close').click();
	await expect(modal).toBeHidden();
	await expect(page.getByTestId('week-total')).toBeFocused();
	await page.getByTestId('week-total').click();
	await expect(modal).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(modal).toBeHidden();
});

test('the modal opens on the week total, inactive, archived and deleted contracts included', async ({ page, baseURL }) => {
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
		// A deleted contract's 17m move to the system Deleted Contract (safe deletion)
		const doomed = (await send('POST', '/api/contracts', { clientId, name: 'Doomed', isActive: true })).contract.id;
		await send('POST', '/api/time-entries', { contractId: doomed, date: weekStart, duration: '17m' });
		const deletion = await fetch(`/api/contracts/${doomed}`, { method: 'DELETE' });
		if (!deletion.ok) throw new Error(`DELETE contract: ${deletion.status} ${await deletion.text()}`);
		return archived;
	}, seed);

	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	// 1h30 + 45m + 2h (inactive) + 33m (archived) + 17m (deleted)
	await expect(page.getByTestId('week-total')).toHaveText('5h 5m');
	await page.getByTestId('week-total').click();
	await expect(page.getByTestId('total-time-value')).toHaveText('5h 5m');
	await expect(page.getByTestId('total-time-entry-count')).toHaveText('5 entries');

	// Inactive, archived and deleted together behind one closed toggle, each marked, all ticked
	const hidden = page.getByTestId('total-time-inactive');
	await expect(hidden.locator('summary')).toHaveText('Show inactive, archived and deleted (3)');
	await hidden.locator('summary').click();
	await expect(page.getByTestId(`total-time-contract-${archivedId}`)).toBeChecked();
	await expect(page.getByTestId(`total-time-contract-${seed.gammaId}`)).toBeChecked();
	const statuses = (await hidden.getByTestId('total-time-contract-status').allTextContents()).sort();
	expect(statuses).toEqual(['archived', 'deleted', 'inactive']);
	await expect(hidden.locator('label', { hasText: 'Deleted Contract' }).locator('input')).toBeChecked();

	// Unticking the archived one drops exactly its 33m (the deleted time stays counted)
	await page.getByTestId(`total-time-contract-${archivedId}`).uncheck();
	await expect(page.getByTestId('total-time-value')).toHaveText('4h 32m');
});

test('opened from an earlier week, the viewed week is the default range', async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'total-time-week');
	const seed = await seedTotals(page, Date.now().toString(36));
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Previous week' }).click();
	await page.getByTestId('week-total').click();
	await expect(page.getByTestId('total-time-preset-viewed-week')).toHaveAttribute('aria-pressed', 'true');
	// The viewed week leads the quick ranges
	await expect(page.locator('[data-testid^="total-time-preset-"]').first()).toHaveAttribute('data-testid', 'total-time-preset-viewed-week');
	await expect(page.getByTestId('total-time-from')).not.toHaveValue(seed.weekStart);
	await expect(page.getByTestId('total-time-message')).toHaveText('No time recorded');
	await expect(page.getByTestId('total-time-entry-count')).toHaveText('0 entries');
	// A backdrop click closes it
	await page.getByTestId('total-time-backdrop').click({ position: { x: 5, y: 5 } });
	await expect(page.getByTestId('total-time-modal')).toBeHidden();
});

test('a failed total offers Try again and keeps the choices (A18)', async ({ page, baseURL, isMobile }) => {
	test.skip(isMobile, 'desktop layout');
	await signInAsFreshUser(page, baseURL, 'total-time-retry');
	const seed = await seedTotals(page, Date.now().toString(36));
	await page.route('**/api/time-entries/total**', (route) => route.fulfill({ status: 500, body: '{"error":"boom"}' }));
	await openTotalTime(page);
	await expect(page.getByTestId('total-time-message')).toHaveText("Couldn't load the total");
	await expect(page.getByTestId('total-time-value')).toHaveText('–');
	await page.getByTestId(`total-time-contract-${seed.betaId}`).uncheck();
	await expect(page.getByTestId('total-time-retry')).toBeVisible();
	await page.unroute('**/api/time-entries/total**');
	await page.getByTestId('total-time-retry').click();
	await expect(page.getByTestId('total-time-value')).toHaveText('1h 30m');
	await expect(page.getByTestId(`total-time-contract-${seed.betaId}`)).not.toBeChecked();
});

test('desktop: a long contract list scrolls inside the bounded modal (A13)', async ({ page, baseURL, isMobile }) => {
	test.skip(isMobile, 'desktop layout');
	await page.setViewportSize({ width: 1280, height: 720 });
	await signInAsFreshUser(page, baseURL, 'total-time-long');
	await seedTotals(page, Date.now().toString(36), 14);
	const modal = await openTotalTime(page);
	await expect(page.getByTestId('total-time-value')).toHaveText('2h 15m');

	const viewport = page.viewportSize()!;
	const inViewport = async () => {
		const box = (await modal.boundingBox())!;
		expect(box.x).toBeGreaterThan(0);
		expect(box.y).toBeGreaterThan(0);
		expect(box.x + box.width).toBeLessThan(viewport.width);
		expect(box.y + box.height).toBeLessThan(viewport.height);
	};
	await inViewport();
	await expect(modal.getByTestId('total-time-close')).toBeInViewport();
	const scroller = page.getByTestId('total-time-contracts-scroller');
	expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

	// Scrolling to the last contract moves only the list: header, dates and total stay put
	const totalBefore = (await page.getByTestId('total-time-value').boundingBox())!;
	await page.getByTestId('total-time-inactive').scrollIntoViewIfNeeded();
	await expect(page.getByTestId('total-time-inactive')).toBeInViewport();
	expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await inViewport();
	await expect(modal.getByTestId('total-time-close')).toBeInViewport();
	await expect(page.getByTestId('total-time-from')).toBeInViewport();
	expect((await page.getByTestId('total-time-value').boundingBox())!.y).toBeCloseTo(totalBefore.y, 0);

	// A15 across 768px is not tested here: AppShell swaps its phone / desktop branch at that width,
	// remounting the time entries panel and with it any open modal (pre-existing, outside 066-TR)
	// Escape with no sheet closes the modal
	await page.keyboard.press('Escape');
	await expect(modal).toBeHidden();
});

test('phone: results screen, then the contract sheet over the same selection @iphone', async ({ page, baseURL, isMobile }) => {
	test.skip(!isMobile, 'iPhone projects only');
	await signInAsFreshUser(page, baseURL, 'total-time-phone');
	// Enough contracts that the sheet's list runs well past the screen
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
	// A02: presets, dates, the Contracts row, the total, By contract, in that order; no checklist here
	const topOf = async (testId: string) => (await page.getByTestId(testId).first().boundingBox())!.y;
	const order = [
		await topOf('total-time-preset-this-week'),
		await topOf('total-time-from'),
		await topOf('total-time-contracts-row'),
		await topOf('total-time-value'),
		await topOf('total-time-breakdown-toggle')
	];
	expect([...order].sort((first, second) => first - second)).toEqual(order);
	expect(await topOf('total-time-to')).toBeCloseTo(await topOf('total-time-from'), 0);
	await expect(page.getByTestId('total-time-contract-list')).toHaveCount(0);
	await expect(page.getByTestId('total-time-contracts-panel')).toHaveCount(0);
	const totalBox = (await page.getByTestId('total-time-value').boundingBox())!;
	expect(totalBox.y + totalBox.height).toBeLessThanOrEqual(viewport.height);
	expect((await page.getByTestId('total-time-preset-all-time').boundingBox())!.height).toBeGreaterThanOrEqual(44);
	const rowCount = (await page.getByTestId('total-time-contracts-row').textContent())!.match(/(\d+) selected/)![1];

	// A03: the sheet: All / None in its header, the count only in its footer, Done
	await page.getByTestId('total-time-contracts-row').tap();
	const sheet = page.getByTestId('total-time-contract-sheet');
	await expect(sheet).toBeVisible();
	await expect(sheet.getByTestId('total-time-selected-count')).toHaveText(`${rowCount} selected`);
	await expect(sheet.getByText(/\d+ selected/)).toHaveCount(1);
	await expect(sheet.getByTestId('total-time-sheet-done')).toBeVisible();
	for (const testId of ['total-time-select-all', 'total-time-select-none', 'total-time-sheet-done']) {
		expect((await sheet.getByTestId(testId).boundingBox())!.height, testId).toBeGreaterThanOrEqual(44);
	}

	// Live: None, then Beta, and the total behind the sheet follows
	await sheet.getByTestId('total-time-select-none').tap();
	await expect(page.getByTestId('total-time-message')).toHaveText('No contracts selected');
	await expect(sheet.getByTestId('total-time-selected-count')).toHaveText('0 selected');
	await sheet.getByTestId(`total-time-contract-${seed.betaId}`).tap();
	await expect(page.getByTestId('total-time-value')).toHaveText('45m');
	await expect(sheet.getByTestId('total-time-selected-count')).toHaveText('1 selected');

	// The archived / deleted disclosure is reached by scrolling the sheet; the footer covers nothing
	const hiddenToggle = sheet.getByTestId('total-time-inactive').locator('summary');
	await hiddenToggle.scrollIntoViewIfNeeded();
	await hiddenToggle.tap();
	const gamma = sheet.getByTestId(`total-time-contract-${seed.gammaId}`);
	await gamma.scrollIntoViewIfNeeded();
	await expect(gamma).toBeInViewport();
	const doneBox = (await sheet.getByTestId('total-time-sheet-done').boundingBox())!;
	const lastRowBox = (await sheet.getByTestId('total-time-contract-row').last().boundingBox())!;
	expect(lastRowBox.y + lastRowBox.height).toBeLessThanOrEqual(doneBox.y);
	// No sideways scroll inside the sheet
	expect(await sheet.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);

	// Done only closes the sheet: the selection stays applied
	await sheet.getByTestId('total-time-sheet-done').tap();
	await expect(sheet).toBeHidden();
	await expect(modal).toBeVisible();
	await expect(page.getByTestId('total-time-value')).toHaveText('45m');
	await expect(page.getByTestId('total-time-contracts-row')).toContainText('1 selected');

	// Escape closes the sheet first, then the modal
	await page.getByTestId('total-time-contracts-row').tap();
	await expect(sheet).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(modal).toBeVisible();
	await expect(page.getByTestId('total-time-value')).toHaveText('45m');
	await page.keyboard.press('Escape');
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
