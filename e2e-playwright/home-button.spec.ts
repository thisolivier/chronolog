/**
 * Sprint 062-DR: "Chronolog" is the home button at the top left of the app bar on every layout,
 * with ‹ › right of it (AppBarHome.svelte). Desktop, the phone's screens (notes list, editor,
 * timesheet with the running pill, /search), Settings and the trash. Home is a step Back undoes,
 * and on a phone it leaves a running capture running (SH-07). Each test signs up its own user.
 * Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to docs/review/screenshots/sprint-062/.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { editor } from './notes-helpers';
import { expectInsideViewportWidth, expectNoSidewaysScroll, expectTouchSized } from './iphone-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-062');

type Seeded = { contractId: string; noteId: string; noteTitle: string };

const homeButton = (page: Page) => page.getByRole('button', { name: 'Chronolog home' });
const pathOf = (page: Page) => new URL(page.url()).pathname;

async function open(page: Page, target: string) {
	await page.goto(target);
	await page.waitForLoadState('networkidle');
}

async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await open(page, '/');
	return page.evaluate(async (suffix) => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status}`);
			return response.json();
		};
		const clientId = (await post('/api/clients', { name: `Homeward Industries ${suffix}`, shortCode: `H${suffix.slice(-5).toUpperCase()}` })).client.id;
		const contractId = (await post('/api/contracts', { clientId, name: `Platform migration ${suffix}`, isActive: true })).contract.id;
		const noteTitle = `Kick-off with the platform team and the long agenda ${suffix}`;
		const noteId = (await post('/api/notes', { contractId, title: noteTitle, content: `# ${noteTitle}\n\nAgenda.` })).note.id;
		return { contractId, noteId, noteTitle };
	}, suffix);
}

async function startTimer(page: Page, contractId: string) {
	await page.evaluate(async (contractId) => {
		const started = new Date(Date.now() - 47 * 60_000);
		const pad = (value: number) => String(value).padStart(2, '0');
		const date = `${started.getFullYear()}-${pad(started.getMonth() + 1)}-${pad(started.getDate())}`;
		const startTime = `${pad(started.getHours())}:${pad(started.getMinutes())}`;
		const response = await fetch('/api/timer/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contractId, date, startTime, confirmed: true, description: 'Migration plan' })
		});
		if (!response.ok) throw new Error(`start: ${response.status}`);
	}, contractId);
}

const timerId = (page: Page) => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null);

/** Home, then ‹ ›, left to right with nothing between them */
async function expectHomeThenHistory(page: Page, scope = page.locator('body')) {
	const width = page.viewportSize()?.width;
	const home = (await scope.getByTestId('app-home-button').boundingBox())!;
	const buttons = (await scope.getByTestId('history-buttons').boundingBox())!;
	expect(home.x).toBeLessThan(buttons.x);
	expect(buttons.x - (home.x + home.width)).toBeLessThanOrEqual(8);
	// Nothing to the right (Find, Search, the pill) lies over them: the buttons never give way
	for (const testId of ['app-home-button', 'history-buttons']) {
		const target = scope.getByTestId(testId);
		const uncovered = await target.evaluate((element) => {
			const box = element.getBoundingClientRect();
			return [box.left + 2, box.right - 2].every((x) => element.contains(document.elementFromPoint(x, box.top + box.height / 2)));
		});
		expect(uncovered, `${testId} is not covered (${JSON.stringify(await target.boundingBox())}, viewport ${width})`).toBe(true);
	}
}

test.describe('desktop', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('Chronolog then ‹ › on the app bar, Settings and the trash; home is a step', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'home-desktop');
		const data = await seed(page);
		await open(page, `/notes/${data.contractId}/${data.noteId}`);
		await expect(editor(page)).toBeVisible();
		const topBar = page.getByTestId('app-top-bar');
		await expectHomeThenHistory(page, topBar);
		await topBar.screenshot({ path: path.join(SCREENSHOTS, 'desktop-01-app-bar.png') });

		await homeButton(page).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByTestId('history-back')).toHaveAttribute('aria-label', /^Back to Kick-off/);
		await page.getByTestId('history-back').click();
		await expect(page).toHaveURL(`/notes/${data.contractId}/${data.noteId}`);

		await open(page, '/settings');
		await expectHomeThenHistory(page);
		await expect(page.getByRole('link', { name: 'Back to app' })).toBeVisible();
		await homeButton(page).click();
		await expect(page).toHaveURL(/\/$/);

		await open(page, '/notes/trash');
		await expectHomeThenHistory(page);
		await homeButton(page).click();
		await expect(page).toHaveURL(/\/$/);
	});
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('the same group on every screen; home keeps the capture running @iphone', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'home-phone');
		const data = await seed(page);
		const width = page.viewportSize()!.width;

		// Notes list: no title in the bar (the list header names the context, 060-DR)
		await open(page, `/notes/${data.contractId}`);
		await expect(page.getByTestId('mobile-back')).toBeEnabled();
		await expectHomeThenHistory(page);
		await expectTouchSized(homeButton(page));
		await expectTouchSized(page.getByTestId('mobile-back'));
		await expectTouchSized(page.getByTestId('mobile-forward'));
		await expect(page.getByTestId('mobile-forward')).toBeDisabled();
		await expect(page.getByTestId('mobile-back')).toHaveAttribute('aria-label', 'Back to Chronolog');
		await expectNoSidewaysScroll(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, `phone-${width}-01-notes-list.png`) });

		// Note editor
		await page.getByText(data.noteTitle).first().click();
		await expect(editor(page)).toBeVisible();
		await expectHomeThenHistory(page);
		await expectNoSidewaysScroll(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, `phone-${width}-02-note-editor.png`) });

		// Home, then ‹ comes back to the note (review: ‹ at home did nothing)
		const notePath = pathOf(page);
		await homeButton(page).click();
		await expect.poll(() => pathOf(page)).toBe('/');
		await expect(page.getByTestId('mobile-back')).toHaveAttribute('aria-label', /^Back to Kick-off/);
		await page.getByTestId('mobile-back').click();
		await expect.poll(() => pathOf(page)).toBe(notePath);
		await expect(editor(page)).toBeVisible();

		// Timesheet with the running pill: the title gives way, the bar keeps everything else
		await startTimer(page, data.contractId);
		await open(page, '/time');
		await expect(page.getByTestId('timesheet-scroll')).toBeVisible();
		const pill = page.getByTestId('timer-indicator');
		await expect(pill).toBeVisible();
		await expectHomeThenHistory(page);
		await expectInsideViewportWidth(page, pill);
		await expectInsideViewportWidth(page, page.getByTestId('mobile-search-link'));
		await expectNoSidewaysScroll(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, `phone-${width}-03-timesheet-running.png`) });

		// Home: level 0, the capture still running
		const runningId = await timerId(page);
		expect(runningId).not.toBeNull();
		await homeButton(page).click();
		await expect.poll(() => pathOf(page)).toBe('/');
		await expect(page.getByTestId('mobile-back')).toBeEnabled();
		expect(await timerId(page)).toBe(runningId);

		// Home → search icon → ‹ returns to the home screen
		await page.getByTestId('mobile-search-link').click();
		await expect.poll(() => pathOf(page)).toBe('/search');
		await expect(page.getByTestId('mobile-back')).toHaveAttribute('aria-label', 'Back to Chronolog');
		await page.getByTestId('mobile-back').click();
		await expect.poll(() => pathOf(page)).toBe('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();

		// /search: the same group, capture access, no "Back to app"
		await open(page, '/search');
		await expectHomeThenHistory(page);
		await expect(page.getByTestId('search-back-to-app')).toHaveCount(0);
		await expect(page.getByTestId('mobile-search-link')).toHaveCount(0);
		await expect(pill).toBeVisible();
		await expectNoSidewaysScroll(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, `phone-${width}-04-search.png`) });
		await homeButton(page).click();
		await expect.poll(() => pathOf(page)).toBe('/');

		// The narrowest phone, timesheet and pill
		await page.setViewportSize({ width: 320, height: 640 });
		await open(page, '/time');
		await expect(pill).toBeVisible();
		await expectInsideViewportWidth(page, pill);
		await expectHomeThenHistory(page);
		await expectNoSidewaysScroll(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, 'phone-320-03-timesheet-running.png') });
		await open(page, `/notes/${data.contractId}/${data.noteId}`);
		await expect(editor(page)).toBeVisible();
		await expectHomeThenHistory(page);
		await expectInsideViewportWidth(page, pill);
		await expectNoSidewaysScroll(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, 'phone-320-02-note-editor.png') });

	});
});
