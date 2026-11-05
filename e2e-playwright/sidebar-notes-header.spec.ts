/**
 * Sprint 051-UI: sidebar tidy, the all-notes view, note header polish.
 * - "Notes" heading (no `+`) opens `/notes/all`: every note of every contract (archived too),
 *   newest change first, pins not floated, rows name client · contract; a real step for Back /
 *   Forward ("All notes"), survives reload, the heading shows as selected.
 * - Archived's chevron sits in the right-hand column with the client chevrons and toggles.
 * - Settings is a row in the scrolling list (under Trash); nothing but the timer below the list.
 *   Settings → Clients still creates clients and contracts.
 * - Save status pill "Saved" / "Saving" keeps the header line still while typing (1280, 390, 320).
 * - Move / Export lost their chevrons; the note code copies on click with a "Copied" bubble.
 * Desktop 1280 and phone 390 (touch). Each test signs up its own user (`E2E_USER_PREFIX=qa-051`).
 * Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to docs/review/screenshots/sprint-051/.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { editor } from './notes-helpers';
import { expectNoSidewaysScroll } from './iphone-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-051');

type Seeded = {
	clientName: string;
	otherClientName: string;
	contractName: string;
	archivedContractName: string;
	/** Oldest change first */
	noteIds: string[];
	pinnedNoteId: string;
	firstContractId: string;
};

const pathOf = (page: Page) => new URL(page.url()).pathname;

/**
 * Two clients: "Atlas" with two contracts (one archived) and "Birch" with one. Four notes, made
 * in order (so later = newer), the oldest pinned.
 */
async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await page.goto('/');
	const seeded = await page.evaluate(async (suffix) => {
		const send = async (method: string, url: string, body: unknown) => {
			const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const code = suffix.slice(-4).toUpperCase();
		const clientName = `Atlas ${suffix}`;
		const otherClientName = `Birch ${suffix}`;
		const clientId = (await send('POST', '/api/clients', { name: clientName, shortCode: `A${code}` })).client.id;
		const otherClientId = (await send('POST', '/api/clients', { name: otherClientName, shortCode: `B${code}` })).client.id;
		const contractName = `Survey ${suffix}`;
		const archivedContractName = `Old phase ${suffix}`;
		const firstContractId = (await send('POST', '/api/contracts', { clientId, name: contractName, isActive: true })).contract.id;
		await send('POST', '/api/contracts', { clientId, name: `Build ${suffix}`, isActive: true });
		const archivedContractId = (await send('POST', '/api/contracts', { clientId, name: archivedContractName, isActive: true })).contract.id;
		const otherContractId = (await send('POST', '/api/contracts', { clientId: otherClientId, name: `Garden ${suffix}`, isActive: true })).contract.id;
		const noteIds: string[] = [];
		const plan = [
			[firstContractId, 'Oldest pinned'],
			[archivedContractId, 'In the archive'],
			[otherContractId, 'Other client'],
			[firstContractId, 'Newest of all']
		];
		for (const [contractId, title] of plan) {
			noteIds.push((await send('POST', '/api/notes', { contractId, title: `${title} ${suffix}`, content: `# ${title} ${suffix}\n\nBody.` })).note.id);
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		await send('PUT', `/api/notes/${encodeURIComponent(noteIds[0])}/pin`, { pinned: true });
		await send('PATCH', `/api/contracts/${archivedContractId}`, { archived: true });
		return { clientName, otherClientName, contractName, archivedContractName, noteIds, pinnedNoteId: noteIds[0], firstContractId };
	}, suffix);
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	return seeded;
}

const rowIds = (page: Page) => page.getByTestId('note-list-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-note-id')));

async function measure(target: Locator) {
	const box = (await target.boundingBox())!;
	return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
}

/** Open the newest note, type, and check the header line does not move between Saving and Saved */
async function expectStableHeaderWhileTyping(page: Page, shotPrefix: string | null) {
	const header = page.getByTestId('note-editor-header');
	const status = page.getByTestId('save-status');
	const code = page.getByTestId('note-code-copy');
	await expect(status).toHaveAttribute('data-status', 'saved');
	await expect(status).toHaveText('Saved');
	const savedHeader = await measure(header);
	const savedStatus = await measure(status);
	const savedCode = await measure(code);
	if (shotPrefix) await page.screenshot({ path: path.join(SCREENSHOTS, `${shotPrefix}-header-saved.png`) });

	await editor(page).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' more words', { delay: 15 });
	await expect(status).toHaveText('Saving');
	expect(['unsaved', 'saving']).toContain(await status.getAttribute('data-status'));
	expect(await measure(header)).toEqual(savedHeader);
	expect(await measure(status)).toEqual(savedStatus);
	expect(await measure(code)).toEqual(savedCode);
	if (shotPrefix) await page.screenshot({ path: path.join(SCREENSHOTS, `${shotPrefix}-header-saving.png`) });

	await expect(status).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
	expect(await measure(header)).toEqual(savedHeader);
	expect(await measure(status)).toEqual(savedStatus);
}

test.describe('desktop 1280', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('Notes heading opens all notes: newest first, no pin float, a step with a label', async ({ page, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'all-desktop');
		const data = await seed(page);
		const sidebar = page.getByTestId('app-sidebar');
		const heading = sidebar.getByTestId('sidebar-notes-heading');
		await expect(heading).toHaveText('Notes');
		await expect(page.getByTestId('sidebar-new-contract')).toHaveCount(0);
		const startPath = pathOf(page);

		await heading.click();
		await expect.poll(() => pathOf(page)).toBe('/notes/all');
		await expect(heading).toHaveAttribute('aria-current', 'page');
		await expect(page.getByTestId('note-list-context')).toContainText('All notes');
		await expect(page).toHaveTitle('Chronolog · Notes · All notes');
		// Newest first, the pinned (oldest) note last: pins are not floated; the archived contract's note is there
		await expect.poll(() => rowIds(page)).toEqual([...data.noteIds].reverse());
		const pinnedRow = page.locator(`[data-testid="note-list-row"][data-note-id="${data.pinnedNoteId}"]`);
		await expect(pinnedRow).toHaveAttribute('data-pinned', 'true');
		await expect(pinnedRow.getByTestId('note-row-contract')).toHaveText(`${data.clientName} · ${data.contractName}`);
		await expect(
			page.locator(`[data-testid="note-list-row"][data-note-id="${data.noteIds[1]}"]`).getByTestId('note-row-contract')
		).toHaveText(`${data.clientName} · ${data.archivedContractName}`);
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-02-all-notes.png') });

		// A note opens inside the view; Back names "All notes"
		await page.locator(`[data-testid="note-list-row"][data-note-id="${data.noteIds[2]}"] > button`).first().click();
		await expect.poll(() => pathOf(page)).toMatch(new RegExp(`^/notes/all/[^/]+/${data.noteIds[2].replace(/\./g, '\\.')}$`));
		await expect(editor(page)).toContainText('Other client');
		await expect(page.getByTestId('history-back')).toHaveAttribute('aria-label', 'Back to All notes');

		// Survives a reload, then Back / Forward walk through it
		await page.reload();
		await expect.poll(() => rowIds(page)).toEqual([...data.noteIds].reverse());
		await page.getByTestId('history-back').click();
		await expect.poll(() => pathOf(page)).toBe('/notes/all');
		await expect(heading).toHaveAttribute('aria-current', 'page');
		await page.getByTestId('history-back').click();
		await expect.poll(() => pathOf(page)).toBe(startPath);
		await expect(heading).not.toHaveAttribute('aria-current', 'page');
		await expect(page.getByTestId('history-forward')).toHaveAttribute('aria-label', 'Forward to All notes');
		await page.getByTestId('history-forward').click();
		await expect.poll(() => pathOf(page)).toBe('/notes/all');
		await expect.poll(() => rowIds(page)).toEqual([...data.noteIds].reverse());
	});

	test('sidebar: Archived chevron in the client chevron column; Settings in the list', async ({ page, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'sidebar-desktop');
		const data = await seed(page);
		const sidebar = page.getByTestId('app-sidebar');
		const toggle = sidebar.getByTestId('sidebar-archived-toggle');
		const archivedChevron = sidebar.getByTestId('sidebar-archived-chevron');
		const clientChevron = sidebar
			.locator(`[data-testid="sidebar-client-group"][aria-label="${data.clientName}"]`)
			.getByTestId('sidebar-client-chevron');
		const initiallyExpanded = (await toggle.getAttribute('aria-expanded')) === 'true';
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', String(!initiallyExpanded));
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', String(initiallyExpanded));
		if (!initiallyExpanded) await toggle.click();
		await expect(sidebar.getByText(data.archivedContractName)).toBeVisible();

		const archivedBox = await measure(archivedChevron);
		const clientBox = await measure(clientChevron);
		expect(Math.abs(archivedBox.x + archivedBox.width - (clientBox.x + clientBox.width))).toBeLessThanOrEqual(1);
		expect(Math.abs(archivedBox.width - clientBox.width)).toBeLessThanOrEqual(1);

		// Settings is in the scrolling list, under Trash; below the list there is only the timer
		const scroll = sidebar.getByTestId('sidebar-scroll');
		const settingsRow = scroll.getByTestId('sidebar-settings-link');
		await expect(settingsRow).toBeVisible();
		expect((await measure(settingsRow)).y).toBeGreaterThan((await measure(scroll.getByTestId('sidebar-trash-link'))).y);
		expect(await scroll.evaluate((element) => element.parentElement!.children.length)).toBe(2);
		if (browserName === 'chromium') await sidebar.screenshot({ path: path.join(SCREENSHOTS, 'desktop-01-sidebar.png') });

		await settingsRow.click();
		await expect.poll(() => pathOf(page)).toBe('/settings');
		// New contracts (and clients) are made in Settings → Clients now that the sidebar `+` is gone
		await page.goto('/admin/clients');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Add Client' }).click();
		await expect(page.getByRole('heading', { name: 'New Client' })).toBeVisible();
		await page.getByRole('link', { name: data.clientName }).click();
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Add Contract' }).click();
		await expect(page.getByRole('heading', { name: 'New Contract' })).toBeVisible();
	});

	test('note header: Saved / Saving pill keeps the line still; no chevrons; copy the code', async ({ page, baseURL, browserName, context }) => {
		await signInAsFreshUser(page, baseURL, 'header-desktop');
		const data = await seed(page);
		const noteId = data.noteIds[3];
		await page.goto(`/notes/${data.firstContractId}/${noteId}`);
		await expect(editor(page)).toContainText('Newest of all');
		await expect(page.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-haspopup', 'menu');
		await expect(page.getByRole('button', { name: 'Export', exact: true })).toHaveAttribute('aria-haspopup', 'menu');
		await page.getByRole('button', { name: 'Export', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Export as Markdown' })).toBeVisible();
		await page.keyboard.press('Escape');
		await page.locator('body').click({ position: { x: 700, y: 600 } });

		await expectStableHeaderWhileTyping(page, browserName === 'chromium' ? 'desktop-03' : null);

		const code = page.getByTestId('note-code-copy');
		await expect(code).toHaveAttribute('title', 'Copy note code');
		expect(await code.evaluate((element) => getComputedStyle(element).cursor)).toBe('pointer');
		if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await code.click();
		await expect(page.getByTestId('note-code-copied')).toHaveText('Copied');
		await expect(page.getByTestId('note-code-copy-announcement')).toHaveText('Copied');
		if (browserName === 'chromium') {
			expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(noteId);
			await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-04-copied.png') });
		}
		await expect(page.getByTestId('note-code-copied')).toBeHidden({ timeout: 4000 });
	});
});

test.describe('phone 390', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('sidebar list, all notes and the note header on a phone', async ({ page, baseURL, browserName }) => {
		await signInAsFreshUser(page, baseURL, 'phone');
		const data = await seed(page);
		const shoot = async (name: string) => {
			// Let chevron rotations and bubbles finish their transitions first
			if (browserName === 'chromium') await page.waitForTimeout(300);
			if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, name) });
		};
		// Home is the sidebar: Notes heading, chevrons, Archived, Trash, Settings, then the timer
		const scroll = page.getByTestId('sidebar-scroll');
		await expect(scroll.getByTestId('sidebar-notes-heading')).toBeVisible();
		await expect(scroll.getByTestId('sidebar-settings-link')).toBeAttached();
		const toggle = scroll.getByTestId('sidebar-archived-toggle');
		if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		const archivedChevron = await measure(scroll.getByTestId('sidebar-archived-chevron'));
		const clientChevron = await measure(
			scroll.locator(`[data-testid="sidebar-client-group"][aria-label="${data.clientName}"]`).getByTestId('sidebar-client-chevron')
		);
		expect(Math.abs(archivedChevron.x + archivedChevron.width - (clientChevron.x + clientChevron.width))).toBeLessThanOrEqual(1);
		await expectNoSidewaysScroll(page);
		await shoot('phone-01-sidebar.png');
		await scroll.getByTestId('sidebar-settings-link').scrollIntoViewIfNeeded();
		await shoot('phone-01b-sidebar-settings.png');

		// The heading opens all notes (level 1), titled "All notes"
		await scroll.getByTestId('sidebar-notes-heading').tap();
		await expect.poll(() => pathOf(page)).toBe('/notes/all');
		await expect(page.getByTestId('mobile-context-title')).toHaveText('All notes');
		await expect.poll(() => rowIds(page)).toEqual([...data.noteIds].reverse());
		await expectNoSidewaysScroll(page);
		await shoot('phone-02-all-notes.png');

		// A note from it; Back reads "All notes" and returns there
		await page.locator(`[data-testid="note-list-row"][data-note-id="${data.noteIds[3]}"] > button`).first().tap();
		await expect(editor(page)).toContainText('Newest of all');
		await expect(page.getByTestId('mobile-back')).toContainText('All notes');
		await expectStableHeaderWhileTyping(page, browserName === 'chromium' ? 'phone-03' : null);
		await expectNoSidewaysScroll(page);

		await page.getByTestId('note-code-copy').tap();
		await expect(page.getByTestId('note-code-copied')).toHaveText('Copied');
		await shoot('phone-04-copied.png');
		await expect(page.getByTestId('note-code-copied')).toBeHidden({ timeout: 4000 });

		// The narrowest phone: the header still holds still while typing
		await page.setViewportSize({ width: 320, height: 640 });
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
		await expectStableHeaderWhileTyping(page, browserName === 'chromium' ? 'phone-05-320' : null);
		await expectNoSidewaysScroll(page);

		await page.getByTestId('mobile-back').tap();
		await expect.poll(() => pathOf(page)).toBe('/notes/all');
	});
});
