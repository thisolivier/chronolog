/**
 * Sprint 027-CL: journeys 1, 2, 7, 8 and 10 of docs/review/2026-11-03-ux-journeys.md as
 * regression tests. Every screen state has a URL, reload returns to it, Back walks the real
 * history, and the sidebar, list and editor agree on the note's client and contract.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { editor, expectNotesScopedTo, moveOpenNote, openNoteId } from './notes-helpers';
import { signInAsFreshUser } from './fresh-user';

// In order, in one worker: parallel API note creates under one user race for note IDs
test.describe.configure({ mode: 'default' });

/** Load a URL and wait until the app is hydrated (clicks before that are lost) */
async function open(page: Page, path: string) {
	const response = await page.goto(path);
	await page.waitForLoadState('networkidle');
	return response;
}

async function reloadApp(page: Page) {
	await page.reload();
	await page.waitForLoadState('networkidle');
}

type Seeded = {
	contractA: string;
	contractB: string;
	nameA: string;
	nameB: string;
	noteA: string;
	noteB: string;
	weekEntryDate: string;
};

const sidebarItem = (page: Page, contractId: string) => page.locator(`[data-contract-id="${contractId}"]`).first();
const pathOf = (page: Page) => new URL(page.url()).pathname;

/** Resolve once the element's scrollTop has not changed for 5 animation frames in a row */
async function waitForSteadyScroll(scroller: Locator) {
	await scroller.evaluate(
		(element) =>
			new Promise<void>((resolve) => {
				let last = element.scrollTop;
				let steadyFrames = 0;
				const check = () => {
					steadyFrames = element.scrollTop === last ? steadyFrames + 1 : 0;
					last = element.scrollTop;
					if (steadyFrames >= 5) resolve();
					else requestAnimationFrame(check);
				};
				requestAnimationFrame(check);
			})
	);
}

/** The timesheet scroll positions the app has stored for this tab (navigation store) */
async function rememberedScrollTops(page: Page): Promise<number[]> {
	return page.evaluate(() => {
		const stored = JSON.parse(sessionStorage.getItem('chronolog:timesheet-scroll') ?? '{}') as Record<string, { scrollTop: number }>;
		return Object.values(stored).map((position) => position.scrollTop);
	});
}

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Two contracts under one client, a note in each (A links to B), and a card linking to A last week */
async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	const lastWeek = new Date();
	lastWeek.setDate(lastWeek.getDate() - 7);
	const weekEntryDate = isoDate(lastWeek);
	await open(page, '/');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	const seeded = await page.evaluate(
		async ({ suffix, weekEntryDate }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (!response.ok) throw new Error(`${url} ${response.status}`);
				return response.json();
			};
			const contracts = await (await fetch('/api/contracts')).json();
			const clientId = contracts[0].clientId;
			const nameA = `Nav A ${suffix}`;
			const nameB = `Nav B ${suffix}`;
			const contractA = (await post('/api/contracts', { clientId, name: nameA, isActive: true })).contract.id;
			const contractB = (await post('/api/contracts', { clientId, name: nameB, isActive: true })).contract.id;
			const noteB = (await post('/api/notes', { contractId: contractB, title: `Bravo ${suffix}`, content: `Bravo ${suffix}` }))
				.note.id;
			const noteA = (
				await post('/api/notes', { contractId: contractA, title: `Alpha ${suffix}`, content: `Alpha ${suffix} see [[${noteB}]]` })
			).note.id;
			await post('/api/time-entries', {
				date: weekEntryDate,
				durationMinutes: 30,
				contractId: contractA,
				description: `Card ${suffix} [[${noteA}]]`
			});
			return { contractA, contractB, nameA, nameB, noteA, noteB };
		},
		{ suffix, weekEntryDate }
	);
	await reloadApp(page);
	await expect(sidebarItem(page, seeded.contractA)).toBeVisible();
	return { ...seeded, weekEntryDate };
}

test('J1: settings and back keeps the note; a moved note stays open under its new contract', async ({ page }) => {
	const data = await seed(page);
	await open(page, `/notes/${data.contractA}/${data.noteA}`);
	await expect(editor(page)).toContainText('Alpha');

	await page.getByRole('link', { name: 'Settings', exact: true }).click();
	await expect(page).toHaveURL(/\/settings/);
	await page.getByRole('link', { name: 'Back to app' }).click();
	await expect(page).toHaveURL(`/notes/${data.contractA}/${data.noteA}`);
	await expect.poll(() => openNoteId(page)).toBe(data.noteA);
	await expect(sidebarItem(page, data.contractA)).toHaveAttribute('aria-current', 'page');

	await moveOpenNote(page, new RegExp(data.nameB));
	await expect(page).toHaveURL(`/notes/${data.contractB}/${data.noteA}`);
	await expect(sidebarItem(page, data.contractB)).toHaveAttribute('aria-current', 'page');
	// 054-DR: the sidebar names the contract; list and editor are scoped to it (names are screen-reader text)
	await expectNotesScopedTo(page, data.contractB);

	await reloadApp(page);
	await expect.poll(() => openNoteId(page)).toBe(data.noteA);
	await expect(sidebarItem(page, data.contractB)).toHaveAttribute('aria-current', 'page');
});

test('J2: timesheet card link, cross-contract link, then Back to the same week and scroll', async ({ page, baseURL }) => {
	// Its own user (044-CL): the same journey in the other browser seeds cards on the same day for
	// the shared user, which moved the list between saving and restoring its scroll position
	await signInAsFreshUser(page, baseURL, 'journey-2');
	const data = await seed(page);
	await page.getByRole('button', { name: 'Time Entries' }).click();
	await expect(page).toHaveURL(/\/time\/\d{4}-W\d{2}$/);
	const currentWeekPath = pathOf(page);
	await page.getByRole('button', { name: 'Previous week' }).click();
	// Read the week path only once the URL has moved (044-CL: it could be read too early)
	await expect.poll(() => pathOf(page)).not.toBe(currentWeekPath);
	const weekPath = pathOf(page);
	await expect(page.getByTitle(data.noteA).first()).toBeVisible();
	const scroller = page.getByTestId('timesheet-scroll');
	// Scroll like a user once the panel has placed the new week (its scroll stops moving)
	await waitForSteadyScroll(scroller);
	await scroller.hover();
	await page.mouse.wheel(0, 250);
	await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
	// Bring the link into view as the click would, then wait until the panel has remembered
	// where the list is (sessionStorage), which is what Back restores; no fixed sleeps (044-CL)
	const cardLink = page.getByTitle(data.noteA).first();
	await cardLink.scrollIntoViewIfNeeded();
	await waitForSteadyScroll(scroller);
	const savedScroll = await scroller.evaluate((element) => element.scrollTop);
	await expect.poll(() => rememberedScrollTops(page)).toContain(savedScroll);

	await cardLink.click();
	await expect(page).toHaveURL(`/notes/${data.contractA}/${data.noteA}`);
	await expect(sidebarItem(page, data.contractA)).toHaveAttribute('aria-current', 'page');

	// In-editor link to a note under another contract: everything follows it. The editor of A
	// must be loaded first; a click while it is still (re)rendering its content can be lost
	// (WebKit, 044-CL), so the click is retried until the URL follows
	await expect.poll(() => openNoteId(page)).toBe(data.noteA);
	await expect(async () => {
		await editor(page).locator('[data-wiki-link]').first().click({ timeout: 2000 });
		await expect(page).toHaveURL(`/notes/${data.contractB}/${data.noteB}`, { timeout: 2000 });
	}).toPass();
	await expect(sidebarItem(page, data.contractB)).toHaveAttribute('aria-current', 'page');
	await expectNotesScopedTo(page, data.contractB);

	await page.goBack();
	await expect(page).toHaveURL(`/notes/${data.contractA}/${data.noteA}`);
	await expect.poll(() => openNoteId(page)).toBe(data.noteA);
	await page.goBack();
	await expect(page).toHaveURL(weekPath);
	await expect(page.getByTitle(data.noteA).first()).toBeVisible();
	await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(savedScroll - 2);
	await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(savedScroll + 2);

	await page.goForward();
	await expect(page).toHaveURL(`/notes/${data.contractA}/${data.noteA}`);
	await expect.poll(() => openNoteId(page)).toBe(data.noteA);
});

test('J7: the same note URL in two tabs shows the same place; a stale tab cannot overwrite', async ({ page, context }) => {
	const data = await seed(page);
	const notePath = `/notes/${data.contractA}/${data.noteA}`;
	await open(page, notePath);
	const secondTab = await context.newPage();
	await open(secondTab, notePath);
	for (const tab of [page, secondTab]) {
		await expect.poll(() => openNoteId(tab)).toBe(data.noteA);
		await expect(sidebarItem(tab, data.contractA)).toHaveAttribute('aria-current', 'page');
	}
	// Both tabs on the latest server copy (opening a markdown-only note may save it once)
	await page.waitForTimeout(2500);
	await reloadApp(page);
	await expect.poll(() => openNoteId(page)).toBe(data.noteA);
	await reloadApp(secondTab);
	await expect.poll(() => openNoteId(secondTab)).toBe(data.noteA);
	await page.waitForTimeout(2500);

	await page.bringToFront();
	await editor(page).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' tab one');
	await expect
		.poll(
			() => page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.content as string, data.noteA),
			{ timeout: 10000 }
		)
		.toContain('tab one');
	await secondTab.bringToFront();
	await editor(secondTab).click();
	await secondTab.keyboard.press('End');
	await secondTab.keyboard.type(' tab two');
	await expect(secondTab.getByTestId('save-status')).toHaveAttribute('data-status', 'conflict', { timeout: 10000 });
});

test.describe('J8: phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('three levels deep survives reload; Back goes up and never leaves the app from inside', async ({ page }) => {
		const data = await seed(page);
		await open(page, '/');
		await sidebarItem(page, data.contractA).click();
		await expect(page).toHaveURL(`/notes/${data.contractA}`);
		// The list header names the contract; the title bar does not repeat it (060-DR)
		await expect(page.getByTestId('note-list-header')).toContainText(data.nameA);
		await expect(page.getByTestId('mobile-context-title')).toHaveCount(0);
		// In-app moves only: the list's only row is the seeded note
		await page.getByTestId('note-list-row').first().getByRole('button').first().click();
		await expect(page).toHaveURL(`/notes/${data.contractA}/${data.noteA}`);
		await expect(editor(page)).toBeVisible();

		await reloadApp(page);
		await expect(page).toHaveURL(`/notes/${data.contractA}/${data.noteA}`);
		await expect(editor(page)).toBeVisible();
		await expect(page.getByTestId('mobile-back')).toBeVisible();

		// App Back: note -> list -> home
		await page.getByTestId('mobile-back').click();
		await expect(page).toHaveURL(`/notes/${data.contractA}`);
		await page.getByTestId('mobile-back').click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	});

	test('a note opened from the timesheet goes Back to the timesheet; a fresh deep link Backs into the app', async ({ page, context }) => {
		const data = await seed(page);
		await open(page, `/time/${await currentWeekParam(page)}`);
		const thisWeekPath = pathOf(page);
		await page.getByRole('button', { name: 'Previous week' }).click();
		// The week URL is set by a client navigation: wait for it rather than read it at once
		await expect.poll(() => pathOf(page)).not.toBe(thisWeekPath);
		const weekPath = pathOf(page);
		await page.getByTitle(data.noteA).first().click();
		await expect(editor(page)).toBeVisible();
		await expect(page.getByTestId('mobile-back')).toContainText('Week');
		await page.getByTestId('mobile-back').click();
		await expect(page).toHaveURL(weekPath);

		// Opened straight on a note (bookmark, shared link): browser Back stays in the app
		const fresh = await context.newPage();
		await open(fresh, `/notes/${data.contractB}/${data.noteB}`);
		await expect(editor(fresh)).toBeVisible();
		await fresh.goBack();
		await expect(fresh).toHaveURL(/localhost:\d+\/$/);
		await expect(fresh.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	});
});

async function currentWeekParam(page: Page): Promise<string> {
	await open(page, '/');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Time Entries' }).click();
	await expect(page).toHaveURL(/\/time\//);
	return pathOf(page).split('/').pop() as string;
}

test('J10: reload at every distinct URL returns to the same place', async ({ page }) => {
	const data = await seed(page);
	const weekParam = await currentWeekParam(page);
	const places: Array<{ path: string; check: () => Promise<void> }> = [
		{
			path: '/',
			check: async () => {
				await expect(page.getByRole('button', { name: 'Time Entries' })).toHaveAttribute('aria-current', 'page');
			}
		},
		{
			path: `/time/${weekParam}`,
			check: async () => {
				await expect(page.getByRole('button', { name: 'Time Entries' })).toHaveAttribute('aria-current', 'page');
			}
		},
		{
			path: '/time/2026-W40',
			check: async () => {
				await expect(page.locator('.sticky.top-0')).toContainText('Week 40');
			}
		},
		{
			path: `/notes/${data.contractA}`,
			check: async () => {
				await expect(sidebarItem(page, data.contractA)).toHaveAttribute('aria-current', 'page');
				await expectNotesScopedTo(page, data.contractA, { editorToo: false });
			}
		},
		{
			path: `/notes/${data.contractA}/${data.noteA}`,
			check: async () => {
				await expect.poll(() => openNoteId(page)).toBe(data.noteA);
				await expect(sidebarItem(page, data.contractA)).toHaveAttribute('aria-current', 'page');
			}
		},
		{
			path: `/notes/${data.contractA}/new`,
			check: async () => {
				await expect(page.getByTestId('draft-note-row')).toBeVisible();
				await expect(editor(page)).toBeVisible();
			}
		}
	];
	for (const place of places) {
		await open(page, place.path);
		await place.check();
		await reloadApp(page);
		await expect(page).toHaveURL(place.path);
		await place.check();
	}

	// A note under the wrong contract in the URL is corrected in place
	await open(page, `/notes/${data.contractB}/${data.noteA}`);
	await expect(page).toHaveURL(`/notes/${data.contractA}/${data.noteA}`);
	await expect(sidebarItem(page, data.contractA)).toHaveAttribute('aria-current', 'page');

	// The collapsed sidebar is a preference that survives reload
	await open(page, `/time/${weekParam}`);
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();
	await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute('aria-expanded', 'false');
	await reloadApp(page);
	await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute('aria-expanded', 'false');
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();

	// Not a real week: the friendly 404
	const response = await open(page, '/time/2026-W60');
	expect(response?.status()).toBe(404);
});
