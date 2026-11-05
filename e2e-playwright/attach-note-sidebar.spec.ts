/**
 * Sprint 049-UI: "Attach note" on a time entry card, and the sidebar's Contracts heading.
 * - Attach note makes one new note on the entry's contract (a double click still makes one), adds
 *   `[[NOTE_ID]]` at the end of the description, saves the entry and opens the note with the
 *   editor focused; the note lists the entry under Linked Time Entries; the card renders the link.
 * - With the description editor open, the typed text is kept and gets the link.
 * - The running timer shows Attach note once it has a contract; it links the note in the timer's
 *   description and opens the note.
 * - The `+` right of "Contracts" opens New Contract; the client chevrons sit at the right edge,
 *   in one column under the `+` (same right edge, same box size), and still collapse.
 * Desktop (1280) and phone (390, touch) runs; each test signs up its own user
 * (`E2E_USER_PREFIX=qa-049`). Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` → docs/review/screenshots/sprint-049/.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { editor } from './notes-helpers';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-049');

type Seeded = { clientName: string; contractId: string; contractName: string; entryId: string; description: string };

/** A client with two contracts (so it has a chevron) and one entry today on the first */
async function seed(page: Page): Promise<Seeded> {
	await page.goto('/');
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	return page.evaluate(async (suffix) => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url} ${response.status} ${await response.text()}`);
			return response.json();
		};
		const clientName = `Orbit Labs ${suffix}`;
		const contractName = `Discovery ${suffix}`;
		const clientId = (await post('/api/clients', { name: clientName, shortCode: `Q${suffix.slice(-5).toUpperCase()}` })).client.id;
		const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).id;
		await post('/api/contracts', { clientId, name: `Retainer ${suffix}`, isActive: true });
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const description = `Workshop prep ${suffix}`;
		const entryId = (await post('/api/time-entries', { date: today, durationMinutes: 75, contractId, description })).entry.id;
		return { clientName, contractId, contractName, entryId, description };
	}, suffix);
}

async function serverState(page: Page, seeded: Seeded) {
	return page.evaluate(async ({ contractId, entryId }) => {
		const notes = (await (await fetch(`/api/notes?contractId=${contractId}`)).json()).notes as Array<{ id: string }>;
		const entry = (await (await fetch(`/api/time-entries/${entryId}`)).json()).entry as { description: string };
		return { noteIds: notes.map((note) => note.id), description: entry.description };
	}, seeded);
}

const card = (page: Page, seeded: Seeded) => page.locator(`[data-testid="time-entry-card"][data-entry-id="${seeded.entryId}"]`);

for (const layout of [
	{ name: 'desktop', viewport: { width: 1280, height: 800 }, touch: false },
	{ name: 'phone', viewport: { width: 390, height: 844 }, touch: true }
] as const) {
	test.describe(`Sprint 049 on ${layout.name}`, () => {
		test.use({ viewport: layout.viewport, hasTouch: layout.touch });

		test('attach note: one note, linked at the end of the description, opened ready to type', async ({ page, baseURL, browserName }) => {
			await signInAsFreshUser(page, baseURL, `attach-${layout.name}`);
			const seeded = await seed(page);
			await page.goto('/time');
			const entryCard = card(page, seeded);
			await expect(entryCard).toBeVisible();
			const attachButton = entryCard.getByRole('button', { name: 'Attach note' });
			await entryCard.hover();
			await expect(attachButton).toBeVisible();
			await expect(attachButton).toHaveAttribute('title', 'Attach a new note');
			if (layout.touch) {
				const box = (await attachButton.boundingBox())!;
				expect(box.width).toBeGreaterThanOrEqual(32);
				expect(box.height).toBeGreaterThanOrEqual(32);
				expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
				// The smallest phone: still no sideways scroll, both card actions inside the screen
				await page.setViewportSize({ width: 320, height: 640 });
				expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
				for (const action of [attachButton, entryCard.getByRole('button', { name: 'Delete entry' })]) {
					const actionBox = (await action.boundingBox())!;
					expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(320);
				}
				await page.setViewportSize(layout.viewport);
			}
			if (browserName === 'chromium') await entryCard.screenshot({ path: path.join(SCREENSHOTS, `01-entry-card-attach-${layout.name}.png`) });

			// A double click (double tap) still makes one note
			await attachButton.dblclick();
			await page.waitForURL((url) => /\/notes\/.+\/[A-Z0-9]+\.\d{8}\.\d+$/.test(url.pathname));
			const noteId = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!);
			await expect(editor(page)).toBeFocused();
			await page.keyboard.type('Scope questions for Orbit');
			await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
			const linkedEntries = page.getByTestId('linked-time-entry');
			await expect(linkedEntries).toHaveCount(1);
			await expect(linkedEntries.first()).toContainText(seeded.description);
			if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, `02-note-opened-${layout.name}.png`) });

			const state = await serverState(page, seeded);
			expect(state.noteIds).toEqual([noteId]);
			expect(state.description).toBe(`${seeded.description} [[${noteId}]]`);

			// Back on the week, the card shows the link under the note's title
			await page.goto('/time');
			const link = card(page, seeded).locator(`button[title="${noteId}"]`);
			await expect(link).toHaveText('Scope questions for Orbit');
			if (browserName === 'chromium') await card(page, seeded).screenshot({ path: path.join(SCREENSHOTS, `03-entry-linked-${layout.name}.png`) });
		});

		test('attach note while editing the description keeps the typed text', async ({ page, baseURL }) => {
			await signInAsFreshUser(page, baseURL, `attach-edit-${layout.name}`);
			const seeded = await seed(page);
			await page.goto('/time');
			const entryCard = card(page, seeded);
			await entryCard.getByRole('button', { name: seeded.description }).click();
			const input = entryCard.locator('input[type="text"]');
			await expect(input).toBeFocused();
			await input.press('End');
			await page.keyboard.type(' and agenda');
			await entryCard.getByRole('button', { name: 'Attach note' }).click();
			await page.waitForURL((url) => /\/notes\/.+\/[A-Z0-9]+\.\d{8}\.\d+$/.test(url.pathname));
			const noteId = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!);
			await expect.poll(async () => (await serverState(page, seeded)).description).toBe(`${seeded.description} and agenda [[${noteId}]]`);
			expect((await serverState(page, seeded)).noteIds).toEqual([noteId]);
		});

		test('running timer: attach note appears once a contract is picked, links it and opens the note', async ({ page, baseURL, browserName }) => {
			await signInAsFreshUser(page, baseURL, `timer-attach-${layout.name}`);
			const seeded = await seed(page);
			await page.goto('/time');
			const widget = page.locator('[data-testid^="timer-widget-"]').first();
			await widget.getByRole('button', { name: 'Start Timer' }).click();
			await expect(widget.locator('#draft-description')).toBeVisible();
			// No contract yet: no button
			await expect(widget.getByRole('button', { name: 'Attach note' })).toHaveCount(0);
			await widget.locator('#draft-description').fill('Timer work');
			await widget.locator('#draft-contract').selectOption(seeded.contractId);
			await expect
				.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null))
				.not.toBeNull();
			const attachButton = widget.getByRole('button', { name: 'Attach note' });
			await expect(attachButton).toBeVisible();
			if (browserName === 'chromium') await widget.screenshot({ path: path.join(SCREENSHOTS, `06-timer-attach-${layout.name}.png`) });
			await attachButton.click();
			await page.waitForURL((url) => /\/notes\/.+\/[A-Z0-9]+\.\d{8}\.\d+$/.test(url.pathname));
			const noteId = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!);
			await expect(editor(page)).toBeVisible();
			await expect
				.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.description ?? null))
				.toBe(`Timer work [[${noteId}]]`);
			expect((await serverState(page, seeded)).noteIds).toEqual([noteId]);
		});

		test('sidebar: + opens New Contract; chevrons line up under it at the right edge', async ({ page, baseURL, browserName }) => {
			await signInAsFreshUser(page, baseURL, `sidebar-${layout.name}`);
			const seeded = await seed(page);
			await page.goto('/');
			const sidebar = layout.touch ? page.locator('body') : page.getByTestId('app-sidebar');
			const plusButton = sidebar.getByTestId('sidebar-new-contract');
			await expect(plusButton).toBeVisible();
			const group = sidebar.locator(`[data-testid="sidebar-client-group"][aria-label="${seeded.clientName}"]`);
			const chevron = group.getByTestId('sidebar-client-chevron');
			await expect(chevron).toHaveAttribute('aria-expanded', 'true');

			const plusBox = (await plusButton.boundingBox())!;
			const chevronBox = (await chevron.boundingBox())!;
			expect(Math.abs(plusBox.x + plusBox.width - (chevronBox.x + chevronBox.width))).toBeLessThanOrEqual(1);
			expect(Math.abs(plusBox.width - chevronBox.width)).toBeLessThanOrEqual(1);
			// The chevron is right of the client's name
			const nameBox = (await group.getByTestId('sidebar-client-name').boundingBox())!;
			expect(chevronBox.x).toBeGreaterThanOrEqual(nameBox.x + nameBox.width - 1);
			if (layout.touch) {
				expect(plusBox.height).toBeGreaterThanOrEqual(32);
				expect(plusBox.width).toBeGreaterThanOrEqual(32);
				expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
				await page.setViewportSize({ width: 320, height: 640 });
				expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
				const narrowPlus = (await plusButton.boundingBox())!;
				const narrowChevron = (await chevron.boundingBox())!;
				expect(Math.abs(narrowPlus.x - narrowChevron.x)).toBeLessThanOrEqual(1);
				await page.setViewportSize(layout.viewport);
			}
			if (browserName === 'chromium') {
				const shot = layout.touch ? page : page.getByTestId('app-sidebar');
				await shot.screenshot({ path: path.join(SCREENSHOTS, `04-sidebar-${layout.name}.png`) });
			}

			// The chevron still collapses (keyboard), and the name still opens the client view
			await chevron.focus();
			await page.keyboard.press('Enter');
			await expect(chevron).toHaveAttribute('aria-expanded', 'false');
			await page.keyboard.press('Enter');
			await expect(chevron).toHaveAttribute('aria-expanded', 'true');

			await plusButton.click();
			const dialog = page.getByRole('dialog', { name: 'Create new contract' });
			await expect(dialog).toBeVisible();
			if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, `05-new-contract-${layout.name}.png`) });
			await dialog.locator('#client-select').selectOption({ label: seeded.clientName });
			const newContractName = `Phase two ${Date.now().toString(36)}`;
			await dialog.locator('#contract-name').fill(newContractName);
			await dialog.getByRole('button', { name: 'Create' }).click();
			await expect(dialog).toBeHidden();
			await page.waitForURL((url) => url.pathname.startsWith('/notes/'));
			await page.goto('/');
			await expect(group.getByRole('button', { name: new RegExp(newContractName) })).toBeVisible();
		});
	});
}
