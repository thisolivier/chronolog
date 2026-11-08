/**
 * Sprint 059-DR (design r1 SR-01..SR-07): the /search route inside the app shell with one large
 * query field, and the editor's `[[` wiki-link picker built on the shared LinkPicker.
 * - SR-03's query/context examples through both surfaces (same note order for the same query)
 * - picker: recent notes on `[[`, keyboard and touch insertion (caret kept, undo), dismissal keeps
 *   the typed text and disposes the popup, a slow older reply never replaces newer results
 * - /search: prompt, loading, no matches and failure keep exactly one large field and no header
 *   field; the timer pill shows there when the sidebar is hidden
 * Each test signs up its own user, so the candidate sets are exactly the seeded records.
 * Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to docs/review/screenshots/sprint-059/.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { editor } from './notes-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-059');

type Seeded = {
	suffix: string;
	clientName: string;
	internalClientName: string;
	hungryrootId: string;
	rankGroupId: string;
	generalContractId: string;
	notes: { roles: string; poc: string; hungryCall: string; internal: string; scratch: string };
};

async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
	await page.goto('/');
	return page.evaluate(async (suffix) => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const general = (await (await fetch('/api/contracts')).json())[0];
		const clientName = `Amplitude${suffix}`;
		const internalClientName = `Internal${suffix}`;
		const clientId = (await post('/api/clients', { name: clientName, shortCode: `AM${suffix.slice(-3).toUpperCase()}` })).client.id;
		const internalId = (await post('/api/clients', { name: internalClientName, shortCode: `IN${suffix.slice(-3).toUpperCase()}` })).client.id;
		const hungryrootId = (await post('/api/contracts', { clientId, name: `Hungryroot${suffix}`, isActive: true })).contract.id;
		const rankGroupId = (await post('/api/contracts', { clientId, name: `Rank Group ${suffix}`, isActive: true })).contract.id;
		const internalContractId = (await post('/api/contracts', { clientId: internalId, name: `CCX Internal ${suffix}`, isActive: true })).contract.id;
		const note = async (contractId: string, title: string, body: string) =>
			(await post('/api/notes', { contractId, title, content: `# ${title}\n\n${body}\n` })).note.id as string;
		// Oldest first: within one rank the newest edit comes first
		const scratch = await note(general.id, 'Scratch pad', 'Links go here.');
		const roles = await note(hungryrootId, 'Roles and Permissions', 'Daniel is asking about the correct roles and permissions for the team.');
		const poc = await note(rankGroupId, 'First Client POC Call Notes', 'Confirm roles, ownership and permissions before the first test.');
		const hungryCall = await note(hungryrootId, 'Hungryroot Call Notes', 'Weekly sync about the rollout.');
		const internal = await note(internalContractId, 'Internal access roles', 'Agree the roles needed for project support.');
		await post('/api/time-entries', {
			contractId: hungryrootId,
			date: '2026-11-05',
			startTime: '09:00',
			durationMinutes: 49,
			description: 'Providing guidance on roles and permissions'
		});
		return {
			suffix,
			clientName,
			internalClientName,
			hungryrootId,
			rankGroupId,
			generalContractId: general.id,
			notes: { roles, poc, hungryCall, internal, scratch }
		};
	}, suffix);
}

const picker = (page: Page) => page.getByRole('listbox', { name: 'Link a note' });
const pickerOptions = (page: Page) => picker(page).getByRole('option');
const pickerIds = (page: Page) => pickerOptions(page).evaluateAll((options) => options.map((option) => option.getAttribute('data-note-id')));
const searchNoteIds = (page: Page) =>
	page.getByTestId('search-hit-note').evaluateAll((hits) => hits.map((hit) => hit.getAttribute('data-hit-id')));
const isPhoneProject = (testInfo: TestInfo) => testInfo.project.name.startsWith('iphone');

async function openNote(page: Page, contractId: string, noteId: string, bodyText: string) {
	await page.goto(`/notes/${contractId}/${noteId}`);
	// A deep link gets the app root put under it once loaded (two navigations): let them settle
	await page.waitForLoadState('networkidle');
	await expect(editor(page)).toContainText(bodyText);
}

/** Put the caret on a new line at the end of the note's body paragraph */
async function newLineAfter(page: Page, bodyText: string) {
	// The editor may still take its own opening focus (caret at the start): click until the caret
	// is in the paragraph
	await expect
		.poll(async () => {
			await editor(page).getByText(bodyText).click();
			return page.evaluate(() => {
				const anchor = window.getSelection()?.anchorNode ?? null;
				const element = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element | null);
				return element?.closest('p')?.textContent ?? '';
			});
		})
		.toContain(bodyText);
	await page.keyboard.press('End');
	// ProseMirror reads the DOM selection on `selectionchange`: let it land before the first key
	// it handles itself (an immediate Enter would act on the stale start-of-document selection)
	await page.waitForTimeout(150);
	await page.keyboard.press('Enter');
}

/** Close the picker and remove the typed line, so the scratch note does not match later queries */
async function dismissAndClearLine(page: Page) {
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+Home');
	await page.keyboard.press('Backspace');
}

async function searchFor(page: Page, query: string) {
	await page.goto(`/search?q=${encodeURIComponent(query)}`);
	await expect(page.getByTestId('search-status').or(page.getByTestId('search-results'))).toBeVisible();
	await expect(page.locator('[data-search-hit]').first().or(page.locator('[data-state="empty"]'))).toBeVisible();
}

/** Type `[[query` on a new line of the open note and read the picker's notes; then clear the line */
async function pickerNotesFor(page: Page, query: string): Promise<string[]> {
	await page.keyboard.type(`[[${query}`);
	await expect(page.getByTestId('link-picker')).toHaveAttribute('data-status', 'ready');
	await expect.poll(async () => (await pickerIds(page)).join()).not.toBe('');
	const ids = await pickerIds(page);
	await dismissAndClearLine(page);
	return ids;
}

test.describe('desktop', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('SR-03 examples give the same notes in the same order on /search and in the picker', async ({ page, baseURL }, testInfo) => {
		await signInAsFreshUser(page, baseURL, 'sr03');
		const seeded = await seed(page);
		const { notes } = seeded;

		const clientQuery = seeded.clientName;
		const identityAndContent = `Hungryroot${seeded.suffix} roles`;

		// /search first (typing in the scratch note later must not feed these results)
		// A client name that is in no record's text finds that client's records, with the reason
		await searchFor(page, clientQuery);
		const clientOrder = await searchNoteIds(page);
		expect(clientOrder).toEqual([notes.hungryCall, notes.poc, notes.roles]);
		const contextHit = page.getByTestId('search-hit-note').first();
		await expect(contextHit.getByTestId('search-hit-reason')).toHaveText(`Matches client ${seeded.clientName}`);
		await expect(contextHit.locator('mark')).toHaveCount(0);
		await expect(page.getByTestId('search-hit-entry').getByTestId('search-hit-reason')).toHaveText(`Matches client ${seeded.clientName}`);

		// Contract identity plus content words combine without syntax
		await searchFor(page, identityAndContent);
		const identityOrder = await searchNoteIds(page);
		expect(identityOrder).toEqual([notes.roles]);
		await expect(page.getByTestId('search-hit-note').locator('mark').first()).toHaveText(/roles/i);
		await expect(page.getByTestId('search-hit-entry')).toHaveCount(1);

		// A note's stable code still finds it, first
		await searchFor(page, notes.poc);
		expect((await searchNoteIds(page))[0]).toBe(notes.poc);

		if (testInfo.project.name === 'chromium') {
			await searchFor(page, 'roles');
			await page.getByTestId('global-search-input').press('ArrowDown');
			await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-01-results-mixed.png') });
		}

		// The picker (in a note of another client, so nothing is left out) gives the same notes in the same order
		await openNote(page, seeded.generalContractId, notes.scratch, 'Links go here.');
		await newLineAfter(page, 'Links go here.');
		expect(await pickerNotesFor(page, clientQuery)).toEqual(clientOrder);
		expect(await pickerNotesFor(page, identityAndContent)).toEqual(identityOrder);
		expect((await pickerNotesFor(page, notes.poc))[0]).toBe(notes.poc);

		// In a Rank Group note while timing Hungryroot, the picker is still global
		const started = await page.evaluate(
			async (contractId) =>
				(await fetch('/api/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractId }) })).status,
			seeded.hungryrootId
		);
		expect(started).toBeLessThan(300);
		await openNote(page, seeded.rankGroupId, notes.poc, 'Confirm roles');
		await newLineAfter(page, 'Confirm roles');
		await page.keyboard.type('[[roles');
		// Both clients' roles notes (neither the open contract nor the timer's narrows it); never the open note
		await expect.poll(async () => (await pickerIds(page)).filter((id) => id !== notes.scratch).sort()).toEqual([notes.internal, notes.roles].sort());
		await page.keyboard.press('Escape');
	});

	test('picker: recent notes on [[, keyboard insertion keeps the caret, undo, dismissal keeps the text', async ({ page, baseURL }, testInfo) => {
		await signInAsFreshUser(page, baseURL, 'picker-keys');
		const seeded = await seed(page);
		await openNote(page, seeded.generalContractId, seeded.notes.scratch, 'Links go here.');
		await newLineAfter(page, 'Links go here.');

		// `[[` alone: the most recently edited notes of every client, newest first, the open note left out
		await page.keyboard.type('See [[');
		await expect(picker(page)).toBeVisible();
		await expect.poll(() => pickerIds(page)).toEqual([seeded.notes.internal, seeded.notes.hungryCall, seeded.notes.poc, seeded.notes.roles]);
		const firstRow = pickerOptions(page).first();
		await expect(firstRow).toHaveAttribute('aria-selected', 'true');
		await expect(firstRow.getByTestId('contract-mark')).toBeVisible();
		await expect(firstRow).toContainText(`${seeded.internalClientName} / CCX Internal`);
		// No heading, scope tabs, close control or second input
		const pickerPanel = page.getByTestId('link-picker');
		await expect(pickerPanel.getByRole('heading')).toHaveCount(0);
		await expect(pickerPanel.getByRole('button')).toHaveCount(0);
		await expect(pickerPanel.getByRole('textbox')).toHaveCount(0);

		// Typing continues the query in the editor
		await page.keyboard.type('Roles and Perm');
		// Title match first, then the note whose body has all three words
		await expect.poll(() => pickerIds(page)).toEqual([seeded.notes.roles, seeded.notes.poc]);
		if (testInfo.project.name === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-03-picker-in-editor.png') });

		// Enter inserts: the token becomes the link, the caret follows it, nothing navigates
		await page.waitForTimeout(600); // a separate undo step from the typing
		const urlBefore = page.url();
		await page.keyboard.press('Enter');
		const link = editor(page).locator(`[data-wiki-link][data-note-id="${seeded.notes.roles}"]`);
		await expect(link).toHaveText('Roles and Permissions');
		await expect(picker(page)).toHaveCount(0);
		await expect(editor(page)).toBeFocused();
		expect(page.url()).toBe(urlBefore);
		await expect(editor(page)).not.toContainText('[[');

		// Undo brings back exactly the typed token
		await page.keyboard.press('ControlOrMeta+z');
		await expect(link).toHaveCount(0);
		await expect(editor(page)).toContainText('See [[Roles and Perm');
		await page.keyboard.press('Escape');
		await page.keyboard.press('ControlOrMeta+Shift+z');
		await expect(link).toHaveCount(1);
		await page.keyboard.type('next');
		await expect(editor(page).locator('p', { has: page.locator(`[data-wiki-link][data-note-id="${seeded.notes.roles}"]`) })).toHaveText('See Roles and Permissions next');

		// Arrow keys move the active row; Escape closes and keeps the typed text, for good
		await page.keyboard.press('Enter');
		await page.keyboard.type('[[');
		await expect.poll(async () => (await pickerIds(page)).length).toBeGreaterThan(1);
		await page.keyboard.press('ArrowDown');
		await expect(pickerOptions(page).nth(1)).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowUp');
		await expect(pickerOptions(page).nth(0)).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.type('Hungry');
		await page.keyboard.press('Escape');
		await expect(picker(page)).toHaveCount(0);
		await expect(page.locator('[data-link-picker-layer]')).toHaveCount(0);
		await expect(editor(page)).toContainText('[[Hungry');
		await page.keyboard.type('root');
		await page.waitForTimeout(500);
		await expect(page.locator('[data-link-picker-layer]')).toHaveCount(0);
		await expect(editor(page)).toContainText('[[Hungryroot');

		// A press outside closes it too, keeping the text
		await page.keyboard.press('Enter');
		await page.keyboard.type('[[Internal');
		await expect(picker(page)).toBeVisible();
		await page.getByTestId('app-top-bar').click({ position: { x: 400, y: 20 } });
		await expect(picker(page)).toHaveCount(0);
		await expect(editor(page)).toContainText('[[Internal');
	});

	test('picker: a slow reply to an older query never replaces the newer results', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'picker-stale');
		const seeded = await seed(page);
		await openNote(page, seeded.generalContractId, seeded.notes.scratch, 'Links go here.');
		await newLineAfter(page, 'Links go here.');

		const slowQuery = seeded.clientName;
		await page.route('**/api/notes/search?*', async (route) => {
			if (new URL(route.request().url()).searchParams.get('q') === slowQuery) {
				await new Promise((resolve) => setTimeout(resolve, 2500));
			}
			await route.continue().catch(() => {});
		});
		await page.keyboard.type('[[');
		await expect.poll(async () => (await pickerIds(page)).length).toBe(4);
		const slowRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('q') === slowQuery);
		await page.keyboard.type(slowQuery);
		await slowRequest;
		await page.keyboard.type(' roles');
		await expect.poll(() => pickerIds(page)).toEqual([seeded.notes.poc, seeded.notes.roles]);
		// The older reply (three notes) arrives later; it must not show
		await page.waitForTimeout(3000);
		expect(await pickerIds(page)).toEqual([seeded.notes.poc, seeded.notes.roles]);
		await expect(page.getByTestId('link-picker')).toHaveAttribute('data-status', 'ready');
	});

	test('picker: Enter while a newer query loads inserts from that reply, never the older rows', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'picker-early-enter');
		const seeded = await seed(page);
		await openNote(page, seeded.generalContractId, seeded.notes.scratch, 'Links go here.');
		await newLineAfter(page, 'Links go here.');
		await page.route('**/api/notes/search?*', async (route) => {
			if (new URL(route.request().url()).searchParams.get('q') === 'Daniel') await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue().catch(() => {});
		});
		await page.keyboard.type('[[');
		// Recent notes on screen; the newest (the Internal note) is the active row
		await expect.poll(() => pickerIds(page)).toEqual([seeded.notes.internal, seeded.notes.hungryCall, seeded.notes.poc, seeded.notes.roles]);
		await page.keyboard.type('Daniel');
		await page.keyboard.press('Enter');
		await page.waitForTimeout(400);
		await expect(editor(page).locator('[data-wiki-link]')).toHaveCount(0);
		await expect(editor(page)).toContainText('[[Daniel');
		// The reply for "Daniel" lands: its active row (the only match) is inserted
		await expect(editor(page).locator('[data-wiki-link]')).toHaveCount(1, { timeout: 5000 });
		await expect(editor(page).locator(`[data-wiki-link][data-note-id="${seeded.notes.roles}"]`)).toHaveCount(1);
		await expect(editor(page).locator(`[data-wiki-link][data-note-id="${seeded.notes.internal}"]`)).toHaveCount(0);
	});

	test('picker: an unclosed [[ followed by a long sentence closes the picker instead of failing', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'picker-long');
		const seeded = await seed(page);
		await openNote(page, seeded.generalContractId, seeded.notes.scratch, 'Links go here.');
		await newLineAfter(page, 'Links go here.');
		await page.keyboard.type('[[');
		await expect(picker(page)).toBeVisible();
		await page.keyboard.type('this bracket was never closed and the sentence keeps going well past any sensible note title length');
		await expect(page.locator('[data-link-picker-layer]')).toHaveCount(0);
		await expect(page.getByTestId('link-picker-status').filter({ hasText: 'load' })).toHaveCount(0);
	});

	test('/search keeps one large field in every state, inside the shell, with the timer pill', async ({ page, baseURL }, testInfo) => {
		await signInAsFreshUser(page, baseURL, 'search-states');
		const seeded = await seed(page);
		const field = page.getByTestId('global-search-input');
		const expectOneLargeField = async () => {
			await expect(field).toHaveCount(1);
			await expect(field).toHaveAttribute('data-size', 'large');
			await expect(page.getByTestId('app-top-bar').getByTestId('global-search-input')).toHaveCount(0);
			// Directly above the results area, spanning its column
			const fieldBox = (await field.boundingBox())!;
			const stateBox = (await page.locator('[data-testid="search-status"], [data-testid="search-summary"]').first().boundingBox())!;
			expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(stateBox.y);
			expect(fieldBox.width).toBeGreaterThan(500);
		};

		// Header field → route: the typed text and focus hand over
		await page.goto('/');
		await expect(page.getByTestId('app-top-bar').getByTestId('global-search-input')).toBeVisible();
		await page.waitForLoadState('networkidle');
		await page.keyboard.press('ControlOrMeta+k');
		await page.keyboard.type('nothing-here-at-all');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/search\?q=nothing-here-at-all$/);
		await expect(field).toBeFocused();
		await expect(field).toHaveValue('nothing-here-at-all');
		await expect(page.getByTestId('search-status')).toHaveAttribute('data-state', 'empty');
		await expectOneLargeField();
		if (testInfo.project.name === 'chromium') {
			await page.waitForTimeout(400); // the sidebar's selection fades out
			await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-02b-no-matches.png') });
		}

		// Prompt (no query)
		await page.goto('/search');
		// A deep link gets the app root put under it once loaded (two navigations): let them settle,
		// or WebKit reports the next goto as interrupted (checkpoint B/C flake)
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('search-status')).toHaveAttribute('data-state', 'prompt');
		await expectOneLargeField();

		// Loading
		let release: () => void = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route('**/api/search?*', async (route) => {
			await held;
			await route.continue().catch(() => {});
		});
		await page.goto('/search?q=roles');
		await expect(page.getByTestId('search-status')).toHaveAttribute('data-state', 'loading');
		await expectOneLargeField();
		if (testInfo.project.name === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-02a-loading.png') });
		release();
		await expect(page.getByTestId('search-results')).toBeVisible();
		await expectOneLargeField();
		await page.unroute('**/api/search?*');

		// Failure keeps the query
		await page.route('**/api/search?*', (route) => route.abort());
		await page.goto('/search?q=permissions');
		await expect(page.getByTestId('search-status')).toHaveAttribute('data-state', 'error');
		await expect(field).toHaveValue('permissions');
		await expectOneLargeField();
		await page.unroute('**/api/search?*');
		await page.getByRole('button', { name: 'Try again' }).click();
		await expect(page.getByTestId('search-hit-note').first()).toBeVisible();

		// Inside the shell: sidebar, ‹ ›, and the timer pill once the sidebar is hidden
		expect(
			await page.evaluate(
				async (contractId) =>
					(await fetch('/api/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractId }) })).status,
				seeded.hungryrootId
			)
		).toBeLessThan(300);
		await page.goto('/search?q=roles');
		await page.waitForLoadState('networkidle');
		await expect(page.getByTestId('app-sidebar')).toBeVisible();
		await expect(page.getByTestId('app-top-bar').getByTestId('history-buttons')).toBeVisible();
		await expect(page.getByTestId('timer-widget-sidebar')).toBeVisible();
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(page.getByTestId('timer-indicator').getByTestId('timer-indicator-clock')).toBeVisible();
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
	});
});

test.describe('phone', () => {
	test.use({ hasTouch: true });

	test.beforeEach(async ({ page }, testInfo) => {
		if (!isPhoneProject(testInfo)) await page.setViewportSize({ width: 390, height: 844 });
	});

	test('search on a phone: Chronolog ‹ › and the timer only, one large field, results @iphone', async ({ page, baseURL }, testInfo) => {
		await signInAsFreshUser(page, baseURL, 'phone-search');
		const seeded = await seed(page);
		expect(
			await page.evaluate(
				async (contractId) =>
					(await fetch('/api/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractId }) })).status,
				seeded.hungryrootId
			)
		).toBeLessThan(300);
		await page.goto(`/notes/${seeded.generalContractId}/${seeded.notes.scratch}`);
		await page.waitForLoadState('networkidle');
		await expect(editor(page)).toContainText('Links go here.');
		await page.getByTestId('mobile-search-link').click();
		await expect(page).toHaveURL(/\/search$/);
		const field = page.getByTestId('global-search-input');
		await expect(field).toBeFocused();
		await expect(field).toHaveCount(1);
		await expect(page.getByTestId('mobile-search-link')).toHaveCount(0);
		await expect(page.getByTestId('mobile-find-button')).toHaveCount(0);
		// 062-DR: the home and history group replaces "← Back to app"
		await expect(page.getByTestId('search-back-to-app')).toHaveCount(0);
		await expect(page.getByTestId('app-home-button')).toBeVisible();
		await expect(page.getByTestId('timer-indicator').getByTestId('timer-indicator-clock')).toBeVisible();
		await field.fill('roles');
		await field.press('Enter');
		await expect(page.getByTestId('search-hit-note')).toHaveCount(3);
		await expect(page.getByTestId('search-hit-entry')).toHaveCount(1);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);
		await field.blur();
		if (testInfo.project.name === 'iphone-15') await page.screenshot({ path: path.join(SCREENSHOTS, 'iphone-04-search-results.png'), scale: 'css' });

		// ‹ walks back through the search (Enter was a step) to the note it came from
		await page.getByTestId('mobile-back').click();
		await expect(page).toHaveURL(/\/search$/);
		await page.getByTestId('mobile-back').click();
		await expect(page).toHaveURL(new RegExp(`/notes/${seeded.generalContractId}/${seeded.notes.scratch}$`));
	});

	test('picker on a phone: above the keyboard, tap inserts and keeps the caret @iphone', async ({ page, baseURL }, testInfo) => {
		await signInAsFreshUser(page, baseURL, 'phone-picker');
		const seeded = await seed(page);
		await openNote(page, seeded.generalContractId, seeded.notes.scratch, 'Links go here.');
		await newLineAfter(page, 'Links go here.');
		// A software keyboard leaves about half the screen: shrink the viewport to simulate it
		const width = page.viewportSize()!.width;
		await page.setViewportSize({ width, height: 400 });
		await page.keyboard.type('See [[');
		await expect.poll(async () => (await pickerIds(page)).length).toBe(4);
		const panel = page.getByTestId('link-picker');
		await expect(panel).toHaveAttribute('data-variant', 'phone');
		const panelBox = (await panel.boundingBox())!;
		const tokenBox = (await editor(page).locator('[data-decoration-id]').boundingBox())!;
		expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(400);
		expect(panelBox.y).toBeGreaterThanOrEqual(0);
		// The active query stays visible: the list does not cover it
		const overlaps = panelBox.y < tokenBox.y + tokenBox.height && tokenBox.y < panelBox.y + panelBox.height;
		expect(overlaps).toBe(false);
		await expect(pickerOptions(page).first().getByTestId('link-picker-code')).toBeVisible();
		if (testInfo.project.name === 'iphone-15') await page.screenshot({ path: path.join(SCREENSHOTS, 'iphone-05-picker-above-keyboard.png'), scale: 'css' });

		// Tap inserts the link; the editor keeps focus and the caret follows the link
		await pickerOptions(page).filter({ hasText: 'Roles and Permissions' }).tap();
		const link = editor(page).locator(`[data-wiki-link][data-note-id="${seeded.notes.roles}"]`);
		await expect(link).toHaveCount(1);
		await expect(editor(page)).toBeFocused();
		await expect(picker(page)).toHaveCount(0);
		await page.keyboard.type('next');
		await expect(editor(page).locator('p', { has: page.locator(`[data-wiki-link][data-note-id="${seeded.notes.roles}"]`) })).toHaveText('See Roles and Permissions next');
	});
});
