/**
 * Sprint 054-DR (design r1 stage 3b): notes workspace headers, toolbar, linked time, note position.
 * - NT-01: three columns with one contract never show the client / contract in all three headers;
 *   hiding the navigation brings it back in the list header; all-notes rows carry contract marks.
 * - NT-02: New note is an icon named "New note"; the count sits beside Notes.
 * - NT-04: one "Note actions" menu runs Move, Export and Delete (confirm, then Undo).
 * - NT-05: phone toolbar keeps core formatting and puts the rest under "Formatting".
 * - NT-06: linked time names a contract only when it is not the note's.
 * - SH-07: Back to a long note restores where it was scrolled to.
 * Each test signs up its own user. Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to
 * docs/review/screenshots/sprint-054/.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { editor } from './notes-helpers';
import { expectNoSidewaysScroll } from './iphone-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-054');

type Seeded = {
	clientName: string;
	contractName: string;
	contractId: string;
	otherContractName: string;
	otherClientName: string;
	longNoteId: string;
	shortNoteId: string;
};

const pathOf = (page: Page) => new URL(page.url()).pathname;
const row = (page: Page, noteId: string) => page.locator(`[data-testid="note-list-row"][data-note-id="${noteId}"]`);

/** Client "Amplitude" with "Rank Group" (a long note, a short one) and "Retainer"; client "Birch" with "Garden" */
async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await page.goto('/');
	const seeded = await page.evaluate(async (suffix) => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const code = suffix.slice(-4).toUpperCase();
		const clientName = `Amplitude ${suffix}`;
		const otherClientName = `Birch ${suffix}`;
		const clientId = (await post('/api/clients', { name: clientName, shortCode: `M${code}` })).client.id;
		const otherClientId = (await post('/api/clients', { name: otherClientName, shortCode: `B${code}` })).client.id;
		const contractName = `Rank Group ${suffix}`;
		const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).contract.id;
		await post('/api/contracts', { clientId, name: `Retainer ${suffix}`, isActive: true });
		const otherContractName = `Garden ${suffix}`;
		const otherContractId = (await post('/api/contracts', { clientId: otherClientId, name: otherContractName, isActive: true })).contract.id;
		const paragraphs = Array.from({ length: 60 }, (_, index) => `Paragraph ${index + 1}: separate isolates have different memory and cannot share the SDK singleton.`);
		const longNoteId = (
			await post('/api/notes', { contractId, title: 'Specific response to Brent', content: `# Specific response to Brent\n\n${paragraphs.join('\n\n')}` })
		).note.id;
		await new Promise((resolve) => setTimeout(resolve, 20));
		const shortNoteId = (await post('/api/notes', { contractId, title: 'First call plan', content: '# First call plan\n\nProposed walkthrough.' })).note.id;
		await post('/api/notes', { contractId: otherContractId, title: 'Garden notes', content: '# Garden notes\n\nBeds and paths.' });
		const today = new Date().toISOString().slice(0, 10);
		await post('/api/time-entries', { date: today, durationMinutes: 20, contractId, description: `Reply drafted [[${longNoteId}]]` });
		await post('/api/time-entries', { date: today, durationMinutes: 45, contractId: otherContractId, description: `Cross-client call [[${longNoteId}]]` });
		return { clientName, contractName, contractId, otherContractName, otherClientName, longNoteId, shortNoteId };
	}, suffix);
	return seeded;
}

async function openNote(page: Page, data: Seeded, noteId: string) {
	await page.goto(`/notes/${data.contractId}/${noteId}`);
	await expect(editor(page)).toBeVisible();
	await page.waitForLoadState('networkidle');
}

/** The element that scrolls the open note */
async function noteScrollTop(page: Page): Promise<number> {
	return editor(page).evaluate((element) => {
		for (let current = element.parentElement; current; current = current.parentElement) {
			const overflowY = getComputedStyle(current).overflowY;
			if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 1) return current.scrollTop;
		}
		return -1;
	});
}

async function scrollNoteTo(page: Page, top: number) {
	await editor(page).evaluate((element, top) => {
		for (let current = element.parentElement; current; current = current.parentElement) {
			const overflowY = getComputedStyle(current).overflowY;
			if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 1) {
				current.scrollTop = top;
				return;
			}
		}
	}, top);
}

test.describe('desktop 1280', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('three columns name the contract once; hidden navigation restores it in the list header', async ({ page, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'qa-054-context');
		const data = await seed(page);
		await openNote(page, data, data.longNoteId);

		const listContext = page.getByTestId('note-list-context');
		const editorContext = page.getByTestId('note-editor-context');
		// Sidebar names the contract; the list says Notes and the count; the editor shows the mark only
		await expect(page.getByTestId('app-sidebar').getByText(data.contractName).first()).toBeVisible();
		await expect(listContext).toHaveAttribute('data-owner', 'notes');
		await expect(listContext.locator('h2 > span').first()).toHaveText('Notes');
		await expect(page.getByTestId('note-list-count')).toHaveText('2');
		// Only screen-reader text names the contract in the list and editor headers
		await expect(listContext.getByText(data.contractName)).toHaveClass(/sr-only/);
		await expect(editorContext).toHaveAttribute('data-visible', 'false');
		await expect(editorContext).toHaveClass(/sr-only/);
		await expect(page.getByTestId('note-editor-header').getByTestId('contract-mark')).toBeVisible();
		// Screen readers still hear both
		await expect(editorContext).toContainText(data.contractName);
		await expect(page.getByRole('button', { name: 'New note', exact: true })).toHaveAttribute('title', 'New note');

		// Linked time: the note's own contract is not repeated; the other client's is named
		const linked = page.getByTestId('linked-time-entries');
		await expect(linked.getByTestId('linked-time-entry')).toHaveCount(2);
		await expect(linked.getByTestId('linked-time-entry-contract')).toHaveCount(1);
		await expect(linked.getByTestId('linked-time-entry-contract')).toContainText(data.otherContractName);
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-01-three-columns.png') });

		// Hide the navigation: the list header names the client and contract again
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(listContext).toHaveAttribute('data-owner', 'contract');
		await expect(listContext.getByText(data.contractName)).toBeVisible();
		await expect(listContext.getByText(data.clientName)).toBeVisible();
		await expect(editorContext).toHaveClass(/sr-only/);
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-02-navigation-hidden.png') });
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(listContext).toHaveAttribute('data-owner', 'notes');
	});

	test('all notes: rows carry contract marks and names; header names the scope', async ({ page, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'qa-054-all');
		const data = await seed(page);
		await page.goto('/notes/all');
		await page.waitForLoadState('networkidle');
		const listContext = page.getByTestId('note-list-context');
		await expect(listContext).toHaveAttribute('data-owner', 'all');
		await expect(listContext).toContainText('All notes');
		await expect(page.getByTestId('note-list-count')).toHaveText('3');
		const rows = page.getByTestId('note-list-row');
		await expect(rows).toHaveCount(3);
		for (const rowElement of await rows.all()) {
			await expect(rowElement.getByTestId('contract-mark')).toBeVisible();
			await expect(rowElement.getByTestId('note-row-contract')).toBeVisible();
		}
		await expect(row(page, data.longNoteId).getByTestId('note-row-contract')).toHaveText(`${data.clientName} · ${data.contractName}`);
		await row(page, data.longNoteId).locator('> button').first().click();
		await expect(editor(page)).toContainText('Specific response to Brent');
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-03-all-notes.png') });

		// A single-contract list has no contract text or marks on its rows
		await page.goto(`/notes/${data.contractId}`);
		await expect(page.getByTestId('note-list-row')).toHaveCount(2);
		await expect(page.getByTestId('note-list-row').getByTestId('note-row-contract')).toHaveCount(0);
		await expect(page.getByTestId('note-list-row').getByTestId('contract-mark')).toHaveCount(0);
	});

	test('note actions menu: Move, Export, Delete with confirmation and Undo', async ({ page, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'qa-054-actions');
		const data = await seed(page);
		await openNote(page, data, data.shortNoteId);
		const header = page.getByTestId('note-editor-header');
		// One menu; no loose Move / Export / Delete buttons in the header
		await expect(header.getByRole('button', { name: 'Move', exact: true })).toHaveCount(0);
		await expect(header.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
		const actions = header.getByRole('button', { name: 'Note actions' });
		await actions.click();
		const menu = page.getByRole('menu', { name: 'Note actions' });
		await expect(menu.getByRole('menuitem')).toHaveText([/^Move/, 'Export as Markdown', 'Export as PDF', 'Delete']);
		await expect(menu.getByRole('menuitem').first()).toBeFocused();
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-04-note-actions.png') });
		await page.keyboard.press('Escape');
		await expect(menu).toHaveCount(0);
		await expect(actions).toBeFocused();

		// Export as Markdown downloads the note
		await actions.click();
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('menuitem', { name: 'Export as Markdown' }).click();
		expect((await downloadPromise).suggestedFilename()).toMatch(/\.md$/);

		// Tab from an item leaves through the button, not from a removed item
		await actions.press('Enter');
		await expect(menu.getByRole('menuitem').first()).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(menu).toHaveCount(0);
		// Focus moved on from the button to the next control, not to the page body
		expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement?.tagName)).toBeTruthy();
		await expect(actions).not.toBeFocused();

		// "‹ Move to" goes back to the action list without closing the menu
		await actions.click();
		await page.getByRole('menuitem', { name: 'Move' }).click();
		const moveMenu = page.getByRole('menu', { name: 'Move note to' });
		await expect(moveMenu).toBeVisible();
		await page.getByTestId('move-menu-back').click();
		await expect(menu.getByRole('menuitem')).toHaveText([/^Move/, 'Export as Markdown', 'Export as PDF', 'Delete']);
		await expect(menu.getByRole('menuitem').first()).toBeFocused();

		// Move to another client's contract: the note follows (sidebar, list, editor)
		await page.getByRole('menuitem', { name: 'Move' }).click();
		await page.getByRole('menuitem', { name: new RegExp(data.otherContractName) }).click();
		await expect(page.getByTestId('move-feedback')).toContainText(data.otherContractName);
		await expect(page.getByTestId('note-editor-context')).toContainText(data.otherContractName);
		await expect(row(page, data.shortNoteId)).toBeVisible();

		// Delete asks first, then offers Undo
		await actions.click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		// Focus lands on the confirmation, not the page body
		await expect(page.getByTestId('delete-confirm').getByRole('button', { name: 'Delete' })).toBeFocused();
		await page.getByTestId('delete-confirm').getByRole('button', { name: 'Delete' }).click();
		const toast = page.getByTestId('note-trash-toast');
		await expect(toast).toBeVisible();
		await toast.getByRole('button', { name: 'Undo' }).click();
		await expect(editor(page)).toContainText('First call plan');
	});

	test('an open Note actions menu closes when the note changes by history', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-054-menu-switch');
		const data = await seed(page);
		await openNote(page, data, data.longNoteId);
		await row(page, data.shortNoteId).locator('> button').first().click();
		await expect(editor(page)).toContainText('First call plan');
		await page.getByRole('button', { name: 'Note actions' }).click();
		await page.getByRole('menuitem', { name: 'Move' }).click();
		await expect(page.getByRole('menu', { name: 'Move note to' })).toBeVisible();
		// Back without a click (shortcut / swipe)
		await page.evaluate(() => history.back());
		await expect(editor(page)).toContainText('Specific response to Brent');
		await expect(page.getByRole('menu', { name: 'Move note to' })).toHaveCount(0);
	});

	test('Back to a long note restores where it was scrolled to', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-054-scroll');
		const data = await seed(page);
		await openNote(page, data, data.longNoteId);
		await scrollNoteTo(page, 900);
		await expect.poll(() => noteScrollTop(page)).toBeGreaterThan(850);
		await page.waitForTimeout(150);

		await row(page, data.shortNoteId).locator('> button').first().click();
		await expect(editor(page)).toContainText('First call plan');
		await page.getByTestId('history-back').click();
		await expect(editor(page)).toContainText('Specific response to Brent');
		await expect.poll(() => noteScrollTop(page)).toBeGreaterThan(850);

		// Forward then Back again, through time entries
		await page.getByRole('button', { name: /Time Entries/ }).first().click();
		await expect(editor(page)).toHaveCount(0);
		await page.getByTestId('history-back').click();
		await expect(editor(page)).toContainText('Specific response to Brent');
		await expect.poll(() => noteScrollTop(page)).toBeGreaterThan(850);

		// A fresh open from the list starts at the top as before
		await row(page, data.shortNoteId).locator('> button').first().click();
		await row(page, data.longNoteId).locator('> button').first().click();
		await expect(editor(page)).toContainText('Specific response to Brent');
		await expect.poll(() => noteScrollTop(page)).toBeLessThan(50);
	});
});

test.describe('phone 390', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('toolbar keeps core formatting and moves the rest under Formatting; selection survives', async ({ page, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'qa-054-phone');
		const data = await seed(page);
		await openNote(page, data, data.shortNoteId);
		// Single column: the editor header names its own client and contract
		await expect(page.getByTestId('note-editor-context')).toBeVisible();
		await expect(page.getByTestId('note-editor-context')).toContainText(data.contractName);
		const toolbar = page.getByTestId('editor-toolbar');
		for (const name of ['B', 'I']) await expect(toolbar.getByRole('button', { name, exact: true })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Text style' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Bullet List' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Task List' })).toBeVisible();
		await expect(toolbar.getByRole('button', { name: 'Attach' })).toHaveCount(0);
		await expectNoSidewaysScroll(page);
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'phone-01-note-toolbar.png') });

		// Select a word, then use the overflow: the selection is what gets formatted
		await editor(page).getByText('Proposed walkthrough.').click();
		await page.keyboard.press('End');
		await page.keyboard.press('Shift+ArrowLeft');
		await page.keyboard.press('Shift+ArrowLeft');
		await toolbar.getByRole('button', { name: 'Formatting' }).click();
		const formatting = page.getByRole('menu', { name: 'Formatting' });
		await expect(formatting.getByRole('menuitem')).toHaveText([/Ordered List$/, /Horizontal Rule$/, /Link$/, /Code Block$/, /Attach file$/]);
		await expect(page.getByRole('menu', { name: 'Note actions' })).toHaveCount(0);
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'phone-02-formatting-open.png') });
		await formatting.getByRole('menuitem', { name: /Ordered List/ }).click();
		await expect(editor(page).locator('ol')).toContainText('Proposed walkthrough.');
		// The heading choice sets a style outright
		await toolbar.getByRole('button', { name: 'Text style' }).click();
		await page.getByRole('menuitemradio', { name: 'Heading 2' }).click();
		await expect(editor(page).locator('h2')).toContainText('Proposed walkthrough.');
		await toolbar.getByRole('button', { name: 'Text style' }).click();
		await page.getByRole('menuitemradio', { name: 'Normal text' }).click();
		await expect(editor(page).locator('h2')).toHaveCount(0);

		// Rich opens the Rich / Raw choice
		await toolbar.getByRole('button', { name: 'Editor view' }).click();
		await page.getByRole('menuitemradio', { name: 'Raw markdown' }).click();
		await expect(page.locator('[data-raw-markdown]')).toBeVisible();
		await toolbar.getByRole('button', { name: 'Editor view' }).click();
		await page.getByRole('menuitemradio', { name: 'Rich text' }).click();
		await expect(page.locator('[data-raw-markdown]')).toHaveCount(0);
		await expectNoSidewaysScroll(page);
	});

	test('a long note keeps its place through Back / Forward and the return from capture', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'qa-054-phone-scroll');
		const data = await seed(page);
		await openNote(page, data, data.longNoteId);
		await scrollNoteTo(page, 1200);
		await expect.poll(() => noteScrollTop(page)).toBeGreaterThan(1150);
		await page.waitForTimeout(150);

		// Up to the list (the editor unmounts on a phone), then Forward
		await page.getByTestId('mobile-back').click();
		await expect(editor(page)).toHaveCount(0);
		await page.goForward();
		await expect(editor(page)).toContainText('Specific response to Brent');
		await expect.poll(() => noteScrollTop(page)).toBeGreaterThan(1150);

		// The capture screen (phone home, reached from the running timer) and Back
		const started = await page.evaluate(
			async (contractId) => (await fetch('/api/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractId }) })).status,
			data.contractId
		);
		expect(started).toBeLessThan(300);
		// Phone home loads the running timer; then into the note through the app
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
		await page.getByRole('button', { name: new RegExp(`^${data.contractName}`) }).first().click();
		await row(page, data.longNoteId).locator('> button').first().click();
		await expect(editor(page)).toContainText('Specific response to Brent');
		await scrollNoteTo(page, 1200);
		await page.waitForTimeout(150);
		await page.getByTestId('timer-indicator').click();
		await expect.poll(() => pathOf(page)).toBe('/');
		await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
		await page.goBack();
		await expect(editor(page)).toContainText('Specific response to Brent');
		await expect.poll(() => noteScrollTop(page)).toBeGreaterThan(1150);
		// The running capture is untouched
		await expect
			.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null))
			.not.toBeNull();
	});
});
