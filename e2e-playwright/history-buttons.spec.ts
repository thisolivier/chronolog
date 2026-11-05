/**
 * Sprint 050-UI: Back and Forward through the user's journey, for the Mac app and the installed
 * PWA (no browser buttons there). Every navigation is a step, paging weeks included; typing is
 * not. Desktop: ‹ › before the search field, Cmd/Ctrl+[ ] and Alt+arrows. Phone: "← Back" and a ›
 * that shows only when there is a step ahead. Each test signs up its own user.
 * Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to docs/review/screenshots/sprint-050/.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { editor, openNoteId } from './notes-helpers';
import { expectNoSidewaysScroll } from './iphone-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-050');

test.describe.configure({ mode: 'default' });

type Seeded = { clientId: string; clientName: string; contractId: string; contractName: string; noteId: string; noteTitle: string };

const pathOf = (page: Page) => new URL(page.url()).pathname;
const backButton = (page: Page) => page.getByTestId('history-back');
const forwardButton = (page: Page) => page.getByTestId('history-forward');
const historyLength = (page: Page) =>
	page.evaluate(() => (JSON.parse(sessionStorage.getItem('chronolog:in-app-history') ?? '{"entries":[]}') as { entries: string[] }).entries.length);

async function open(page: Page, target: string) {
	await page.goto(target);
	await page.waitForLoadState('networkidle');
}

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A client with two contracts, a note, and a card two weeks back that links to the note */
async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	const twoWeeksBack = new Date();
	twoWeeksBack.setDate(twoWeeksBack.getDate() - 14);
	await open(page, '/');
	const seeded = await page.evaluate(
		async ({ suffix, cardDate }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url}: ${response.status}`);
				return response.json();
			};
			const clientName = `Journey Co ${suffix}`;
			const contractName = `Journey work ${suffix}`;
			const noteTitle = `Journey note ${suffix}`;
			const clientId = (await post('/api/clients', { name: clientName, shortCode: `J${suffix.slice(-5).toUpperCase()}` })).client.id;
			const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).contract.id;
			// A second contract, so the sidebar shows the client as a group with its own name to click
			await post('/api/contracts', { clientId, name: `Other work ${suffix}`, isActive: true });
			const noteId = (await post('/api/notes', { contractId, title: noteTitle, content: `# ${noteTitle}\n\nStart.` })).note.id;
			await post('/api/time-entries', { date: cardDate, durationMinutes: 45, contractId, description: `Card ${suffix} [[${noteId}]]` });
			return { clientId, clientName, contractId, contractName, noteId, noteTitle };
		},
		{ suffix, cardDate: isoDate(twoWeeksBack) }
	);
	await open(page, '/');
	return seeded;
}

/** Click and wait until the URL has moved off `from` */
async function stepTo(page: Page, action: () => Promise<void>) {
	const from = pathOf(page);
	await action();
	await expect.poll(() => pathOf(page)).not.toBe(from);
	return pathOf(page);
}

test.describe('desktop 1280', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('the journey walks back and replays forward; typing adds no step; reload keeps both', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'history-desktop');
		const data = await seed(page);
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
		// The first page this tab knows: nothing either way
		await expect(backButton(page)).toBeDisabled();
		await expect(forwardButton(page)).toBeDisabled();

		const journey = ['/'];
		journey.push(await stepTo(page, () => page.getByRole('button', { name: 'Time Entries' }).click()));
		journey.push(await stepTo(page, () => page.getByRole('button', { name: 'Previous week' }).click()));
		journey.push(await stepTo(page, () => page.getByRole('button', { name: 'Previous week' }).click()));
		journey.push(await stepTo(page, () => page.getByTitle(data.noteId).first().click()));
		expect(journey.at(-1)).toBe(`/notes/${data.contractId}/${data.noteId}`);
		await expect.poll(() => openNoteId(page)).toBe(data.noteId);

		// Typing in the note (autosaved) is not a step
		await editor(page).click();
		await page.keyboard.press('End');
		await page.keyboard.type(' typed here');
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
		expect(await historyLength(page)).toBe(journey.length);

		const sidebar = page.getByTestId('app-sidebar');
		journey.push(await stepTo(page, () => sidebar.getByRole('button', { name: new RegExp(`^${data.contractName}`) }).first().click()));
		journey.push(
			await stepTo(page, () =>
				sidebar.locator(`[data-testid="sidebar-client-group"][aria-label="${data.clientName}"]`).getByTestId('sidebar-client-name').click()
			)
		);
		expect(journey.at(-1)).toBe(`/notes/client/${data.clientId}`);

		await expect(forwardButton(page)).toBeDisabled();
		await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-01-end-of-journey.png') });
		await page.getByTestId('app-top-bar').screenshot({ path: path.join(SCREENSHOTS, 'desktop-02-top-bar-forward-disabled.png') });
		// Typing in the search field is not a step either
		await page.getByTestId('global-search-input').fill('journey words');
		await page.getByTestId('global-search-input').press('Escape');
		expect(await historyLength(page)).toBe(journey.length);
		await expect(forwardButton(page)).toBeDisabled();
		await expect(backButton(page)).toHaveAttribute('aria-label', `Back to ${data.contractName}`);

		// Back walks it in reverse, one step at a time
		for (let position = journey.length - 2; position >= 0; position--) {
			await backButton(page).click();
			await expect(page).toHaveURL(journey[position]);
			if (position === 4) {
				// Mid-journey reload: both directions survive
				await expect.poll(() => openNoteId(page)).toBe(data.noteId);
				await page.reload();
				await page.waitForLoadState('networkidle');
				await expect(backButton(page)).toBeEnabled();
				await expect(forwardButton(page)).toHaveAttribute('aria-label', `Forward to ${data.contractName}`);
				await expect(backButton(page)).toHaveAttribute('aria-label', /^Back to Week \d+$/);
			}
		}
		await expect(backButton(page)).toBeDisabled();
		await expect(forwardButton(page)).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Time Entries' })).toHaveAttribute('aria-current', 'page');

		// Forward replays it with the keyboard: Alt+Right, then Cmd/Ctrl+]
		const isApple = await page.evaluate(() => /mac|iphone|ipad/i.test(navigator.platform));
		await page.locator('body').click({ position: { x: 640, y: 5 } });
		for (let position = 1; position < journey.length; position++) {
			await page.keyboard.press(position % 2 ? 'Alt+ArrowRight' : `${isApple ? 'Meta' : 'Control'}+BracketRight`);
			await expect(page).toHaveURL(journey[position]);
		}
		await expect(forwardButton(page)).toBeDisabled();

		// Cmd/Ctrl+[ goes back; inside a text field the keys stay with the field
		await page.keyboard.press(`${isApple ? 'Meta' : 'Control'}+BracketLeft`);
		await expect(page).toHaveURL(journey.at(-2)!);
		await page.getByTestId('global-search-input').focus();
		await page.keyboard.press('Alt+ArrowLeft');
		await page.waitForTimeout(300);
		await expect(page).toHaveURL(journey.at(-2)!);
	});

	test('search: submitting is a step; the buttons sit left of the field on the results page', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'history-search');
		const data = await seed(page);
		const start = pathOf(page);
		await page.getByTestId('global-search-input').fill('Journey note');
		await page.getByTestId('global-search-input').press('Enter');
		await expect(page).toHaveURL(/\/search\?q=Journey/);
		await expect(backButton(page)).toBeEnabled();
		await page.getByText(data.noteTitle).first().click();
		await expect(page).toHaveURL(`/notes/${data.contractId}/${data.noteId}`);
		await backButton(page).click();
		await expect(page).toHaveURL(/\/search\?q=Journey/);
		const buttonsBox = await page.getByTestId('history-buttons').boundingBox();
		const fieldBox = await page.getByTestId('global-search-input').boundingBox();
		expect(buttonsBox!.x + buttonsBox!.width).toBeLessThanOrEqual(fieldBox!.x);
		await expect(forwardButton(page)).toHaveAttribute('aria-label', /^Forward to /);
		await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-03-search-page.png') });
		await backButton(page).click();
		await expect(page).toHaveURL(start);
	});
});

test.describe('phone 390', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('Back walks the journey; › appears only with a step ahead and replays it', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'history-phone');
		const data = await seed(page);
		const forward = page.getByTestId('mobile-forward');
		await expect(forward).toHaveCount(0);

		const journey = ['/'];
		journey.push(await stepTo(page, () => page.getByRole('button', { name: 'Time Entries' }).click()));
		journey.push(await stepTo(page, () => page.getByRole('button', { name: 'Previous week' }).click()));
		journey.push(await stepTo(page, () => page.getByRole('button', { name: 'Previous week' }).click()));
		journey.push(await stepTo(page, () => page.getByTitle(data.noteId).first().click()));
		await expect(editor(page)).toBeVisible();
		await expect(forward).toHaveCount(0);

		await page.getByTestId('mobile-back').click();
		await expect(page).toHaveURL(journey[3]);
		await expect(forward).toBeVisible();
		await expect(forward).toHaveAttribute('aria-label', `Forward to ${data.noteTitle}`);
		const box = await forward.boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(32);
		expect(box!.height).toBeGreaterThanOrEqual(32);
		await page.screenshot({ path: path.join(SCREENSHOTS, 'phone-01-back-and-forward.png') });

		for (let position = 2; position >= 0; position--) {
			await page.getByTestId('mobile-back').click();
			await expect(page).toHaveURL(journey[position]);
		}
		// Home (the sidebar): Forward still offered next to the app name
		await expect(forward).toBeVisible();
		await page.screenshot({ path: path.join(SCREENSHOTS, 'phone-02-home-forward.png') });
		for (let position = 1; position < journey.length; position++) {
			await forward.click();
			await expect(page).toHaveURL(journey[position]);
		}
		await expect(forward).toHaveCount(0);

		// The narrowest phone: no sideways scroll with Back and › both showing
		await page.getByTestId('mobile-back').click();
		await expect(page).toHaveURL(journey[3]);
		await page.setViewportSize({ width: 320, height: 640 });
		await expect(forward).toBeVisible();
		await expectNoSidewaysScroll(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, 'phone-03-320-wide.png') });
	});
});
