/**
 * Checkpoint A (design r1, stages 3a + 3b merged): the SH / NT acceptance rows that no single
 * stage spec covers, because they need the shell's timer and the notes headers together.
 * - SH-08 / NT-01: browse Rank Group while timing Hungryroot; follow a cross-contract link to
 *   Daily Pay; every surface keeps its own identity, and the hidden-sidebar pill names Hungryroot.
 * - NT-02 / TC-03: the list's New note creates in the browsed contract, the timer's Attach note in
 *   the timer's contract.
 * - NT-04 / NT-05: Copy code and Rich / Raw still work in the integrated editor header and toolbar.
 * Rows already covered elsewhere: timer-visibility.spec (collapse / hide, phone Finish entry and
 * Back), sidebar-design.spec (Time Entries mutes Notes), notes-headers.spec (no triple label,
 * hidden navigation, Note actions Move / Export / Delete, long-note Back).
 */
import { expect, test, type Page } from '@playwright/test';
import { signInAsFreshUser } from './fresh-user';
import { editor, expectSidebarSelected, sidebarContract } from './notes-helpers';
import { seedCheckpoint, serverTimer, type CheckpointSeed } from './checkpoint-a-seed';

const widget = (page: Page) => page.getByTestId('timer-widget-sidebar');
const headerPill = (page: Page) => page.getByTestId('timer-indicator');
const editorContractId = (page: Page) => page.getByTestId('note-editor-context').getAttribute('data-contract-id');
const listContractId = (page: Page) => page.getByTestId('note-list-context').getAttribute('data-contract-id');

async function startTimerOnHungryroot(page: Page, data: CheckpointSeed) {
	await page.goto(`/notes/${data.hungryrootId}/${data.shortNoteId}`);
	await expect(editor(page)).toBeVisible();
	await widget(page).getByRole('button', { name: 'Start Timer' }).click();
	await expect.poll(async () => (await serverTimer(page))?.contractId ?? null).toBe(data.hungryrootId);
	await expect(widget(page).getByTestId('timer-identity-contract')).toHaveText('Hungryroot');
}

async function expectTimerStillHungryroot(page: Page, data: CheckpointSeed) {
	await expect(widget(page).getByTestId('timer-identity-contract')).toHaveText('Hungryroot');
	await expect(widget(page).getByTestId('timer-identity-client')).toHaveText('Amplitude');
	expect((await serverTimer(page))?.contractId).toBe(data.hungryrootId);
}

test.describe('desktop 1280', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('browse Rank Group and a cross-contract note while timing Hungryroot: each keeps its identity', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'checkpoint-a-scope');
		const data = await seedCheckpoint(page);
		await startTimerOnHungryroot(page, data);

		// Browse Rank Group: sidebar, list and editor follow the browsing; the timer does not
		await sidebarContract(page, 'Rank Group').click();
		await page.getByTestId('note-list-row').filter({ hasText: 'Pricing review' }).click();
		await expect.poll(() => editorContractId(page)).toBe(data.rankGroupId);
		await expect.poll(() => listContractId(page)).toBe(data.rankGroupId);
		await expectSidebarSelected(page, 'Rank Group');
		await expectTimerStillHungryroot(page, data);
		await expect(headerPill(page)).toHaveCount(0);

		// A cross-contract wiki-link opens the Daily Pay note in its own contract
		await editor(page).locator('[data-wiki-link]').first().click();
		await expect(page).toHaveURL(new RegExp(`/notes/${data.dailyPayId}/`));
		await expect.poll(() => editorContractId(page)).toBe(data.dailyPayId);
		await expectSidebarSelected(page, 'Daily Pay');
		await expectTimerStillHungryroot(page, data);

		// Hide the sidebar: the list names Daily Pay, the header pill names the capture (Hungryroot)
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(page.getByTestId('note-list-context')).toHaveAttribute('data-owner', 'contract');
		await expect(page.getByTestId('note-list-context')).toContainText('Daily Pay');
		await expect(headerPill(page)).toBeVisible();
		await expect(headerPill(page)).toHaveAttribute('data-state', 'running');
		await expect(page.getByTestId('timer-indicator-identity')).toContainText('Hungryroot');
		await expect(page.getByTestId('timer-indicator-identity')).not.toContainText('Daily Pay');
		await expect(page.getByTestId('note-editor-context')).toHaveAttribute('data-contract-id', data.dailyPayId);
		// Show it again: one representation (the widget), still Hungryroot
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(headerPill(page)).toHaveCount(0);
		await expectTimerStillHungryroot(page, data);
	});

	test('New note creates in the browsed contract; the timer Attach note in the timer contract', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'checkpoint-a-new-note');
		const data = await seedCheckpoint(page);
		await startTimerOnHungryroot(page, data);
		await widget(page).locator('#draft-description').fill('Event taxonomy');

		// List New note while browsing Rank Group → a Rank Group note
		await sidebarContract(page, 'Rank Group').click();
		await expect.poll(() => listContractId(page)).toBe(data.rankGroupId);
		await page.getByRole('button', { name: 'New note', exact: true }).click();
		await expect(editor(page)).toBeFocused();
		await page.keyboard.type('Loyalty tiers draft');
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
		await expect(page).toHaveURL(new RegExp(`/notes/${data.rankGroupId}/`));
		await expect.poll(() => editorContractId(page)).toBe(data.rankGroupId);
		await expectTimerStillHungryroot(page, data);

		// Timer Attach note while still browsing Rank Group → a Hungryroot note, linked from the timer
		await widget(page).getByRole('button', { name: 'Attach note' }).click();
		await page.waitForURL(new RegExp(`/notes/${data.hungryrootId}/[A-Z0-9]+\\.\\d{8}\\.\\d+$`));
		const attachedId = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!);
		await expect.poll(() => editorContractId(page)).toBe(data.hungryrootId);
		await expect.poll(async () => (await serverTimer(page))?.description ?? null).toBe(`Event taxonomy [[${attachedId}]]`);
		await expectTimerStillHungryroot(page, data);
	});

	test('Copy code and Rich / Raw work in the integrated editor', async ({ page, baseURL, browserName, context }) => {
		await signInAsFreshUser(page, baseURL, 'checkpoint-a-editor');
		const data = await seedCheckpoint(page);
		await startTimerOnHungryroot(page, data);
		await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
		await expect(editor(page)).toBeVisible();

		if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.getByTestId('note-code-copy').click();
		await expect(page.getByTestId('note-code-copied')).toHaveText('Copied');
		if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(data.longNoteId);

		// Rich → Raw shows the markdown; Raw → Rich brings the editor back with the same title
		const modeSwitch = page.getByTestId('editor-mode-switch');
		await modeSwitch.getByRole('button', { name: /raw/i }).click();
		const raw = page.locator('textarea[data-raw-markdown]');
		await expect(raw).toBeVisible();
		await expect(raw).toHaveValue(/^# Specific response to Brent/);
		await modeSwitch.getByRole('button', { name: /rich/i }).click();
		await expect(editor(page).locator('h1').first()).toHaveText('Specific response to Brent');
		await expectTimerStillHungryroot(page, data);
	});
});
