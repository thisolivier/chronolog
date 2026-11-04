/**
 * Sprint 045-CL: the offline outbox in the real UI, with the browser offline (`setOffline`).
 * A note edit and a new time entry made offline are kept on the device (the banner counts them),
 * survive a reload while still offline (service worker page copy + IndexedDB read cache +
 * localStorage outbox), and replay when the network is back, with a "replayed" marker. A note
 * changed meanwhile from a second browser context is held, and the prompt resolves it.
 * Each test signs in as its own fresh user (`qa-045-*` with E2E_USER_PREFIX=qa-045).
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { editor } from './notes-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-045');

// The service worker gives Chromium's offline reload its page (other specs run without one). WebKit
// reloads with the API refused instead (see loadWithoutServer); its route interception and a
// service worker do not mix, so it runs without the worker.
test.use({ serviceWorkers: async ({ browserName }, use) => use(browserName === 'webkit' ? 'block' : 'allow') });

type Seeded = { contractId: string; contractLabel: string; noteId: string; noteText: string; today: string };

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	const noteText = `Offline base ${suffix}`;
	const seeded = await page.evaluate(
		async ({ suffix, noteText }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (!response.ok) throw new Error(`${url} ${response.status} ${await response.text()}`);
				return response.json();
			};
			const clientName = `Outbox ${suffix}`;
			const contractName = `Field ${suffix}`;
			const created = await post('/api/contracts', {
				newClient: { name: clientName, shortCode: `O${suffix.slice(-4).toUpperCase()}` },
				name: contractName,
				isActive: true
			});
			const contractId = (created.contract ?? created).id as string;
			const note = await post('/api/notes', { contractId, content: noteText });
			return { contractId, contractLabel: `${clientName} / ${contractName}`, noteId: note.note.id as string };
		},
		{ suffix, noteText }
	);
	return { ...seeded, noteText, today: isoDate(new Date()) };
}

/** Load the app until the service worker controls the page and has kept a copy of it */
async function openControlled(page: Page, url: string, browserName: string) {
	await page.goto(url);
	if (browserName === 'webkit') return;
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
		await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 10000 });
	}
	// Loaded again through the worker, so this page is kept for an offline reload
	await page.reload();
	await page.waitForLoadState('networkidle');
}

/** The home page, settled (WebKit reports the app's own URL replace as a navigation) */
async function openHome(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	await page.waitForLoadState('networkidle');
}

async function serverNote(page: Page, noteId: string): Promise<{ content: string; updatedAt: string }> {
	return page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note, noteId);
}

/**
 * A full page load with no server. Chromium: offline, the page comes from the service worker
 * (through `location`: Playwright reports no load event for it). Playwright's WebKit cannot load
 * any page while emulated offline ("internal error", even from a service worker), so there the
 * browser goes back online with every API request refused: the server-down case, which still
 * proves the IndexedDB read cache and the stored outbox across the reload.
 */
async function loadWithoutServer(page: Page, context: BrowserContext, browserName: string, url?: string) {
	if (browserName === 'webkit') {
		await page.route('**/api/**', (route) => route.abort('connectionrefused'));
		await context.setOffline(false);
		await (url ? page.goto(url) : page.reload());
		return;
	}
	await page.evaluate((target) => {
		(window as unknown as { beforeOfflineLoad?: boolean }).beforeOfflineLoad = true;
		setTimeout(() => (target ? location.assign(target) : location.reload()), 0);
	}, url ?? null);
	await expect
		.poll(() => page.evaluate(() => !(window as unknown as { beforeOfflineLoad?: boolean }).beforeOfflineLoad).catch(() => false), {
			timeout: 15000
		})
		.toBe(true);
}

/** Back online (and, in WebKit, API requests allowed again) */
async function reconnect(page: Page, context: BrowserContext) {
	await page.unroute('**/api/**');
	await context.setOffline(false);
}

async function goOffline(context: BrowserContext, page: Page) {
	await context.setOffline(true);
	await expect(page.getByTestId('connection-status-offline').first()).toBeVisible();
}

test.describe('offline outbox', () => {
	test('edits and a new entry made offline survive a reload and replay on reconnect', async ({ page, context, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'outbox');
		await openHome(page);
		const seeded = await seed(page);
		// Visit the timesheet and the note online, so both are in the read cache
		await openControlled(page, '/time', browserName);
		await expect(page.locator(`[data-add-entry="${seeded.today}"]`)).toBeVisible();
		// `/time` settles on `/time/<week>` first (a client-side replace)
		await page.waitForURL(/\/time\/\d{4}-W\d{2}$/);
		await page.goto(`/notes/${seeded.contractId}/${seeded.noteId}`);
		await expect(editor(page)).toContainText(seeded.noteText);

		await goOffline(context, page);

		// Edit the note offline: kept on this device, counted in the banner
		await editor(page).click();
		await page.keyboard.press('End');
		await page.keyboard.type(' typed offline');
		await expect(page.getByTestId('note-editor-header').getByTestId('outbox-marker')).toHaveAttribute('data-outbox-status', 'queued', { timeout: 10000 });
		await expect(page.getByTestId('outbox-queued-count').first()).toHaveText('1 change waiting');

		// Add a time entry offline
		await page.getByRole('button', { name: 'Time Entries' }).click();
		await page.locator(`[data-add-entry="${seeded.today}"]`).click();
		const entryText = `Offline entry ${Date.now().toString(36)}`;
		await page.keyboard.type(entryText);
		await page.locator(`#new-entry-${seeded.today}-contract`).selectOption({ label: seeded.contractLabel });
		await page.locator(`#new-entry-${seeded.today}-time`).fill('45m');
		await page.locator(`#new-entry-${seeded.today}-time`).press('Enter');
		const offlineCard = page.locator('[data-testid="time-entry-card"]', { hasText: entryText });
		await expect(offlineCard).toBeVisible();
		await expect(offlineCard.getByTestId('outbox-marker')).toHaveAttribute('data-outbox-status', 'queued');
		await expect(page.getByTestId('outbox-queued-count').first()).toHaveText('2 changes waiting');
		await page.screenshot({ path: path.join(SCREENSHOTS, 'offline-banner-queued.png') });

		// Reload while still offline: the page, the week and the queued entry are still there
		await loadWithoutServer(page, context, browserName);
		await expect(page.getByTestId('connection-status-offline').first()).toBeVisible({ timeout: 15000 });
		await expect(offlineCard).toBeVisible();
		await expect(page.getByTestId('outbox-queued-count').first()).toHaveText('2 changes waiting');
		await loadWithoutServer(page, context, browserName, `/notes/${seeded.contractId}/${seeded.noteId}`);
		await expect(editor(page)).toContainText('typed offline');

		// Back online: the outbox replays and the items get the "replayed" marker
		await reconnect(page, context);
		await expect(page.getByTestId('note-editor-header').getByTestId('outbox-marker')).toHaveAttribute('data-outbox-status', 'replayed', { timeout: 20000 });
		expect((await serverNote(page, seeded.noteId)).content).toContain('typed offline');
		await page.getByRole('button', { name: 'Time Entries' }).click();
		const replayedCard = page.locator('[data-testid="time-entry-card"]', { hasText: entryText });
		await expect(replayedCard.getByTestId('outbox-marker')).toHaveAttribute('data-outbox-status', 'replayed', { timeout: 15000 });
		expect(await replayedCard.getAttribute('data-entry-id')).not.toMatch(/^offline-/);
		await page.screenshot({ path: path.join(SCREENSHOTS, 'replayed-marker.png') });
	});

	test('a note changed on the server meanwhile is held and the prompt resolves it', async ({ page, context, browser, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'conflict');
		await openHome(page);
		const seeded = await seed(page);
		await page.goto(`/notes/${seeded.contractId}/${seeded.noteId}`);
		await expect(editor(page)).toContainText(seeded.noteText);

		await goOffline(context, page);
		await editor(page).click();
		await page.keyboard.press('End');
		await page.keyboard.type(' mine from offline');
		await expect(page.getByTestId('outbox-queued-count').first()).toHaveText('1 change waiting', { timeout: 10000 });

		// Meanwhile, a second browser context (another device) changes the same text
		const otherDevice = await browser.newContext({ storageState: await context.storageState() });
		const base = await (await otherDevice.request.get(`/api/notes/${seeded.noteId}`)).json();
		const otherSave = await otherDevice.request.put(`/api/notes/${seeded.noteId}`, {
			data: { content: `${seeded.noteText} edited on the laptop`, expectedUpdatedAt: base.note.updatedAt }
		});
		expect(otherSave.ok()).toBe(true);
		await otherDevice.close();

		// Back online: held, not overwritten
		await context.setOffline(false);
		const review = page.getByTestId('outbox-review-held').first();
		await expect(review).toBeVisible({ timeout: 20000 });
		expect((await serverNote(page, seeded.noteId)).content).toContain('edited on the laptop');
		await review.click();
		const panel = page.getByTestId('outbox-held-panel');
		await expect(panel.getByTestId('held-server-version')).toContainText('edited on the laptop');
		await expect(panel.getByTestId('held-my-version')).toContainText('mine from offline');
		await page.screenshot({ path: path.join(SCREENSHOTS, 'held-item-prompt.png') });

		await panel.getByRole('button', { name: 'Keep mine' }).click();
		await expect.poll(async () => (await serverNote(page, seeded.noteId)).content, { timeout: 15000 }).toContain('mine from offline');
		await expect(page.getByTestId('outbox-review-held')).toHaveCount(0);
		await expect(panel.getByText('Nothing is waiting for a decision.')).toBeVisible();
	});

	test('a note created offline gets its real ID on reconnect and the editor keeps saving', async ({ page, context, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'create');
		await openHome(page);
		const seeded = await seed(page);
		await page.goto(`/notes/${seeded.contractId}`);
		// The list has loaded (and is cached) before the network goes
		await expect(page.getByTestId('note-list-row')).toHaveCount(1);

		await goOffline(context, page);
		await page.getByRole('button', { name: 'New Note' }).click();
		await expect(editor(page)).toBeFocused();
		const firstLine = `Written on the train ${Date.now().toString(36)}`;
		await page.keyboard.type(firstLine);
		await expect(page).toHaveURL(/\/offline-[0-9a-f]{16}$/, { timeout: 10000 });
		const row = page.getByTestId('note-list-row').filter({ hasText: firstLine });
		await expect(row.getByTestId('outbox-marker')).toHaveAttribute('data-outbox-status', 'queued');

		await context.setOffline(false);
		// The URL and the editor follow the server's ID without a reload
		await expect(page).toHaveURL(new RegExp(`/notes/${seeded.contractId}/O[A-Z0-9]+\\.\\d{8}\\.\\d{3}$`), { timeout: 20000 });
		const realId = page.url().split('/').pop() as string;
		await expect(page.getByTestId('note-editor-header').getByTestId('outbox-marker')).toHaveAttribute('data-outbox-status', 'replayed');
		expect((await serverNote(page, realId)).content).toContain(firstLine);

		// Typing on after the replay saves normally: no "changed elsewhere"
		await editor(page).click();
		await page.keyboard.press('End');
		await page.keyboard.type(' and after arriving');
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
		await expect.poll(async () => (await serverNote(page, realId)).content, { timeout: 10000 }).toContain('and after arriving');
		await expect(page.getByTestId('save-status')).not.toHaveAttribute('data-status', 'conflict');
	});
});
