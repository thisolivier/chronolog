/**
 * Sprint 041-CL in the browser:
 * - Task 1: the running timer's start is an editable time. Moving it changes the elapsed clock; a
 *   start inside a saved entry asks first ("Save anyway"); the future is refused; Escape puts the
 *   old value back; the saved entry measures from the new start. The same edit works on a timer
 *   that has no contract yet (kept in the browser).
 * - Task 3: "Today" in the week header jumps back to the current week and shows today.
 * - Task 4: Settings rows have a direct Archive, and archived rows show Activate.
 *
 * The timer is per user and both browser projects run at once, so the timer tests register a
 * user of their own. Screenshots are taken in chromium only.
 */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOT_DIRECTORY = sprintScreenshotDirectory('sprint-041');

async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
	if (testInfo.project.name !== 'chromium') return;
	await page.screenshot({ path: `${SCREENSHOT_DIRECTORY}/${name}.png` });
}

const pad = (value: number) => String(value).padStart(2, '0');
const isoDate = (moment: Date) => `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
/** Local `HH:MM` `minutesAgo` minutes before now (negative: later). */
function clockMinutesAgo(minutesAgo: number): string {
	const moment = new Date(Date.now() - minutesAgo * 60_000);
	return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}
/** Elapsed clock text (`HH:MM:SS`) in whole minutes */
const clockMinutes = (text: string) => {
	const [hours, minutes] = text.trim().split(':').map(Number);
	return hours * 60 + minutes;
};

async function registerUser(page: Page) {
	const email = `qa-041-pw-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@chronolog.test`;
	await open(page, '/register');
	await page.locator('#name').fill('QA 041');
	await page.locator('#email').fill(email);
	await page.locator('#password').fill('TestPassword123!');
	await page.locator('#confirm-password').fill('TestPassword123!');
	await page.locator('button[type="submit"]').click();
	await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
}

type Seeded = { clientId: string; contractId: string; clientName: string; contractName: string; label: string };

/** A client and a contract through the API, plus (optionally) an entry 120 to 60 minutes ago */
async function seedClient(page: Page, options: { namePrefix: string; withEarlierEntry?: boolean }): Promise<Seeded> {
	await open(page, '/');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
	const earlierEntry = options.withEarlierEntry
		? { date: isoDate(new Date(Date.now() - 120 * 60_000)), duration: `${clockMinutesAgo(120)}-${clockMinutesAgo(60)}` }
		: null;
	return page.evaluate(
		async ({ suffix, namePrefix, earlierEntry }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url} ${response.status} ${await response.text()}`);
				return response.json();
			};
			const clientName = `${namePrefix} ${suffix}`;
			const contractName = `Work ${suffix}`;
			const clientId = (await post('/api/clients', { name: clientName, shortCode: `Q${suffix.slice(-6)}` })).client.id as string;
			const createdContract = await post('/api/contracts', { clientId, name: contractName, isActive: true });
			const contractId = (createdContract.contract ?? createdContract).id as string;
			if (earlierEntry) await post('/api/time-entries', { contractId, ...earlierEntry, description: 'Earlier work' });
			return { clientId, contractId, clientName, contractName, label: `${clientName} / ${contractName}` };
		},
		{ suffix, namePrefix: options.namePrefix, earlierEntry }
	);
}

const timerWidget = (page: Page) => page.locator('[data-testid^="timer-widget-"]').first();

async function elapsedMinutes(page: Page): Promise<number> {
	return clockMinutes((await timerWidget(page).getByTestId('timer-elapsed').textContent()) ?? '');
}

// Relative times below must stay on today's date
const isEarlyMorning = new Date().getHours() < 3;

test.describe('Sprint 041 task 1: editable timer start', () => {
	test.skip(isEarlyMorning, 'needs two hours of today behind us');

	test('move the start, confirm an overlap, refuse the future, then save from the new start', async ({ browser }, testInfo) => {
		const context = await browser.newContext({ storageState: undefined });
		const page = await context.newPage();
		await registerUser(page);
		const seeded = await seedClient(page, { namePrefix: 'Timer 041', withEarlierEntry: true });
		await open(page, '/time');

		const widget = timerWidget(page);
		await widget.getByRole('button', { name: 'Start Timer' }).click();
		await widget.locator('#draft-contract').selectOption({ label: seeded.label });
		await expect
			.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null))
			.not.toBeNull();
		const startField = widget.getByTestId('timer-start-time');
		await expect(startField).toHaveValue(clockMinutesAgo(0));
		expect(await elapsedMinutes(page)).toBe(0);

		// 30 minutes earlier, after the saved entry: no question; the clock jumps
		await startField.fill(clockMinutesAgo(30));
		await screenshot(page, testInfo, '01-editable-start');
		await startField.press('Enter');
		await expect.poll(() => elapsedMinutes(page)).toBeGreaterThanOrEqual(30);
		expect(await elapsedMinutes(page)).toBeLessThanOrEqual(31);

		// 90 minutes ago is inside the 120-60 minute entry: a warning, then Save anyway
		await startField.fill(clockMinutesAgo(90));
		await startField.press('Enter');
		const warning = widget.getByTestId('timer-start-overlap');
		await expect(warning).toContainText(`This start is before the end of ${seeded.label}`);
		await screenshot(page, testInfo, '02-overlap-warning');
		expect(await elapsedMinutes(page)).toBeLessThanOrEqual(31);
		await warning.getByRole('button', { name: 'Save anyway' }).click();
		await expect(warning).toBeHidden();
		await expect.poll(() => elapsedMinutes(page)).toBeGreaterThanOrEqual(90);
		const timer = await page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer);
		expect(timer.startTime.slice(0, 5)).toBe(clockMinutesAgo(90));

		// The future is refused in place; Escape puts the saved start back
		await startField.fill(clockMinutesAgo(-30));
		await startField.press('Enter');
		await expect(widget.getByTestId('timer-start-error')).toContainText('in the future');
		await startField.press('Escape');
		await expect(startField).toHaveValue(clockMinutesAgo(90));
		await expect(widget.getByTestId('timer-start-error')).toBeHidden();

		// Stop and save: the entry measures from the moved start
		await widget.getByRole('button', { name: 'Stop' }).click();
		await expect(widget.locator('#timer-time')).toHaveValue(new RegExp(`^${clockMinutesAgo(90)}-`));
		await widget.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(widget.getByRole('button', { name: 'Start Timer' })).toBeVisible();
		const today = isoDate(new Date());
		const saved = await page.evaluate(async (date) => {
			const body = await (await fetch(`/api/time-entries?from=${date}&to=${date}`)).json();
			return body.entries.filter((entry: { description: string | null }) => entry.description !== 'Earlier work');
		}, today);
		expect(saved).toHaveLength(1);
		expect(saved[0].durationMinutes).toBeGreaterThanOrEqual(90);
		expect(saved[0].durationMinutes).toBeLessThanOrEqual(92);
		expect(saved[0].startTime.slice(0, 5)).toBe(clockMinutesAgo(90));
		await expect(page.locator('[data-testid="time-entry-card"]').filter({ hasText: seeded.contractName }).first()).toBeVisible();
		await screenshot(page, testInfo, '03-saved-entry');
		await context.close();
	});

	test('a timer with no contract yet moves its start in the browser and keeps it on the server', async ({ browser }) => {
		const context = await browser.newContext({ storageState: undefined });
		const page = await context.newPage();
		await registerUser(page);
		const seeded = await seedClient(page, { namePrefix: 'Pending 041' });
		await open(page, '/time');

		const widget = timerWidget(page);
		await widget.getByRole('button', { name: 'Start Timer' }).click();
		await expect(widget.getByTestId('timer-no-contract-hint')).toBeVisible();
		const startField = widget.getByTestId('timer-start-time');
		await startField.fill(clockMinutesAgo(45));
		await widget.getByRole('button', { name: 'Save', exact: true }).click();
		await expect.poll(() => elapsedMinutes(page)).toBeGreaterThanOrEqual(45);

		// Survives a reload (localStorage), then the server draft takes that start
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(timerWidget(page).getByTestId('timer-start-time')).toHaveValue(clockMinutesAgo(45));
		await timerWidget(page).locator('#draft-contract').selectOption({ label: seeded.label });
		await expect
			.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.startTime ?? null))
			.toBe(`${clockMinutesAgo(45)}:00`);
		await timerWidget(page).getByRole('button', { name: 'Stop' }).click();
		await timerWidget(page).getByRole('button', { name: /Discard/ }).click();
		await expect(timerWidget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();
		await context.close();
	});
});

test.describe('Sprint 041 task 3: Today in the week header', () => {
	test('Today goes back to the current week and shows today; disabled there', async ({ page }, testInfo) => {
		const today = isoDate(new Date());
		await open(page, '/time');
		const todayButton = page.getByTestId('week-today-button');
		await expect(todayButton).toBeDisabled();

		await page.getByRole('button', { name: 'Previous week' }).click();
		await page.getByRole('button', { name: 'Previous week' }).click();
		await expect(page.getByRole('button', { name: `Go to ${today}` })).toHaveCount(0);
		await expect(todayButton).toBeEnabled();
		const olderWeekUrl = page.url();
		await screenshot(page, testInfo, '04-today-button');

		await todayButton.click();
		await expect(page.getByRole('button', { name: `Go to ${today}` })).toHaveClass(/bg-ochre-100/);
		await expect(todayButton).toBeDisabled();
		expect(page.url()).not.toBe(olderWeekUrl);
		await expect(page.locator(`[data-day="${today}"]`)).toBeInViewport();

		// The week is in the URL: a reload stays on the current week
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('week-today-button')).toBeDisabled();
	});
});

test.describe('Sprint 041 task 4: Archive and Activate in Settings', () => {
	test('archive then activate a client and a contract from their rows', async ({ page }, testInfo) => {
		const seeded = await seedClient(page, { namePrefix: 'Zeta 041 Archive' });
		await open(page, '/admin/clients');
		const clientRow = page.locator(`tr[data-client-id="${seeded.clientId}"]`);

		await clientRow.getByRole('button', { name: `Archive ${seeded.clientName}` }).click();
		await expect(clientRow.getByText('Archived', { exact: true })).toBeVisible();
		const activateClient = clientRow.getByRole('button', { name: `Activate ${seeded.clientName}` });
		await expect(activateClient).toBeVisible();
		await clientRow.scrollIntoViewIfNeeded();
		await screenshot(page, testInfo, '05-settings-client-activate');
		await activateClient.click();
		await expect(clientRow.getByText('Archived', { exact: true })).toHaveCount(0);
		await expect(clientRow.getByRole('button', { name: `Archive ${seeded.clientName}` })).toBeVisible();

		// The Delete dialog keeps its own Archive option (offered once the client has a note)
		await page.evaluate(async (contractId) => {
			const response = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, title: 'Archive 041 note', content: 'Archive 041 note' })
			});
			if (!response.ok) throw new Error(`note ${response.status}`);
		}, seeded.contractId);
		await open(page, '/admin/clients');
		await clientRow.getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
		await page.keyboard.press('Escape');

		await open(page, `/admin/clients/${seeded.clientId}`);
		const contractRow = page.locator(`[data-contract-id="${seeded.contractId}"]`);
		await contractRow.getByRole('button', { name: `Archive ${seeded.contractName}` }).click();
		await expect(contractRow.getByText('Archived', { exact: true })).toBeVisible();
		await screenshot(page, testInfo, '06-settings-contract-activate');
		await contractRow.getByRole('button', { name: `Activate ${seeded.contractName}` }).click();
		await expect(contractRow.getByText('Archived', { exact: true })).toHaveCount(0);
		await expect(contractRow.getByRole('button', { name: `Archive ${seeded.contractName}` })).toBeVisible();
	});
});
