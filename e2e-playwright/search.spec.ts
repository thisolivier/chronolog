/**
 * Sprint 042-CL: global search from the shell (one list since 046, a note hit and an entry hit open
 * in the workspace, Back returns to the results) and find in page (Cmd/Ctrl+F) in a note and on a
 * timesheet week: count, next/previous, Escape clears, and the note is not edited by finding.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { createContract, editor } from './notes-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-042');
const ENTRY_DATE = '2026-10-20';
const ENTRY_WEEK = '2026-W43';

type Seeded = { word: string; contractId: string; clientId: string; noteId: string; entryIds: string[] };

/** A contract with one note (the word three times) and two entries mentioning the word on one day. */
async function seed(page: Page, browserName: string): Promise<Seeded> {
	const word = `wombat${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	// The contract name must not contain the word: the timesheet shows it on every card
	const contractName = await createContract(page, `Search ${Date.now().toString(36)}${browserName.slice(0, 2)}`);
	return page.evaluate(
		async ({ word, contractName, date }) => {
			const contracts = await (await fetch('/api/contracts')).json();
			const contract = contracts.find((candidate: { name: string }) => candidate.name === contractName);
			const noteResponse = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contractId: contract.id,
					title: `Plan ${word}`,
					content: `# Plan ${word}\n\nFirst paragraph about the ${word} budget.\n\nSecond paragraph: ${word} again, and the end.\n`
				})
			});
			const { note } = await noteResponse.json();
			const entryIds: string[] = [];
			for (const [index, description] of [`Call about ${word} rollout`, `Wrote the ${word} report`].entries()) {
				const response = await fetch('/api/time-entries', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ contractId: contract.id, date, startTime: `0${9 + index}:00`, durationMinutes: 45, description })
				});
				entryIds.push((await response.json()).entry.id);
			}
			return { word, contractId: contract.id, clientId: contract.clientId, noteId: note.id, entryIds };
		},
		{ word, contractName, date: ENTRY_DATE }
	);
}

const findBar = (page: Page) => page.getByTestId('find-bar');
const findCount = (page: Page) => page.getByTestId('find-count');

test('global search from the shell opens a note hit and an entry hit', async ({ page, browserName }) => {
	const seeded = await seed(page, browserName);
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const searchInput = page.getByTestId('global-search-input');
	await expect(searchInput).toBeVisible();

	// Cmd/Ctrl+K focuses the field from anywhere
	await page.locator('body').click({ position: { x: 600, y: 300 } });
	await page.keyboard.press('ControlOrMeta+k');
	await expect(searchInput).toBeFocused();
	await searchInput.fill(seeded.word);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '01-search-bar.png') });
	await searchInput.press('Enter');

	await expect(page).toHaveURL(new RegExp(`/search\\?q=${seeded.word}$`));
	const noteHits = page.getByTestId('search-hit-note');
	const entryHits = page.getByTestId('search-hit-entry');
	await expect(noteHits).toHaveCount(1);
	await expect(entryHits).toHaveCount(2);
	await expect(noteHits.first().locator('mark').first()).toHaveText(seeded.word);
	await expect(page.getByTestId('search-results')).toContainText('Wrote the');
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '02-results.png'), fullPage: true });

	// Arrow keys move from the field into the hits
	await page.getByTestId('global-search-input').press('ArrowDown');
	await expect(noteHits.first()).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(entryHits.first()).toBeFocused();

	// A note hit opens the note under its contract
	await noteHits.first().click();
	await expect(page).toHaveURL(new RegExp(`/notes/${seeded.contractId}/${seeded.noteId}$`));
	await expect(editor(page)).toContainText(`Plan ${seeded.word}`);

	// Back returns to the same results (the URL is the state)
	await page.goBack();
	await expect(page).toHaveURL(new RegExp(`/search\\?q=${seeded.word}$`));
	await expect(entryHits).toHaveCount(2);

	// An entry hit opens its week with the entry focused
	const wroteHit = entryHits.filter({ hasText: 'Wrote the' });
	await wroteHit.click();
	await expect(page).toHaveURL(new RegExp(`/time/${ENTRY_WEEK}$`));
	const card = page.locator(`[data-entry-id="${seeded.entryIds[1]}"]`);
	await expect(card).toBeFocused();
	await expect(card).toBeInViewport();

	// Reload keeps a search page
	await page.goto(`/search?q=${seeded.word}`);
	await page.reload();
	await expect(noteHits).toHaveCount(1);
});

test('Cmd/Ctrl+F in a note highlights matches without editing the note', async ({ page, browserName }) => {
	const seeded = await seed(page, browserName);
	await page.goto(`/notes/${seeded.contractId}/${seeded.noteId}`);
	await expect(editor(page)).toContainText('Second paragraph');
	const updatedBefore = await page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.updatedAt, seeded.noteId);
	const statusBefore = await page.getByTestId('save-status').getAttribute('data-status');

	await editor(page).getByText('First paragraph').click();
	await page.keyboard.press('ControlOrMeta+f');
	await expect(findBar(page)).toBeVisible();
	await expect(page.getByTestId('find-input')).toBeFocused();
	await page.keyboard.type(seeded.word);
	await expect(findCount(page)).toHaveText('1 of 3');
	await expect(editor(page).locator('.chronolog-find-match')).toHaveCount(3);
	await expect(editor(page).locator('.chronolog-find-current')).toHaveCount(1);

	await page.keyboard.press('Enter');
	await expect(findCount(page)).toHaveText('2 of 3');
	await page.keyboard.press('Enter');
	await expect(findCount(page)).toHaveText('3 of 3');
	await page.keyboard.press('Enter');
	await expect(findCount(page)).toHaveText('1 of 3');
	await page.keyboard.press('Shift+Enter');
	await expect(findCount(page)).toHaveText('3 of 3');
	await page.getByTestId('find-previous').click();
	await expect(findCount(page)).toHaveText('2 of 3');
	await expect(editor(page).locator('.chronolog-find-current')).toContainText(seeded.word);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '03-find-in-note.png') });

	await page.getByTestId('find-input').press('Escape');
	await expect(findBar(page)).toHaveCount(0);
	await expect(editor(page).locator('.chronolog-find-match')).toHaveCount(0);

	// Finding is not an edit: no unsaved state, no save, same updatedAt
	await page.waitForTimeout(2500);
	expect(await page.getByTestId('save-status').getAttribute('data-status')).toBe(statusBefore);
	const updatedAfter = await page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.updatedAt, seeded.noteId);
	expect(updatedAfter).toBe(updatedBefore);
});

test('Cmd/Ctrl+F on a timesheet week counts and steps through matches', async ({ page, browserName }) => {
	const seeded = await seed(page, browserName);
	await page.goto(`/time/${ENTRY_WEEK}`);
	const scroller = page.getByTestId('timesheet-scroll');
	await expect(scroller).toContainText('Wrote the');

	// Outside the panel (the top bar), Cmd/Ctrl+F is left to the browser
	await page.getByText('Chronolog', { exact: true }).first().click();
	await page.keyboard.press('ControlOrMeta+f');
	await expect(findBar(page)).toHaveCount(0);

	// Inside the timesheet it opens the find bar
	await scroller.click({ position: { x: 5, y: 5 } });
	await page.keyboard.press('ControlOrMeta+f');
	await expect(findBar(page)).toBeVisible();
	await page.keyboard.type(seeded.word);
	await expect(findCount(page)).toHaveText('1 of 2');
	await page.keyboard.press('Enter');
	await expect(findCount(page)).toHaveText('2 of 2');
	await page.getByTestId('find-next').click();
	await expect(findCount(page)).toHaveText('1 of 2');
	const highlighted = await page.evaluate(() => {
		const registry = (globalThis as unknown as { CSS: { highlights?: Map<string, Set<Range>> } }).CSS.highlights;
		return registry ? (registry.get('chronolog-find')?.size ?? 0) : -1;
	});
	expect([2, -1]).toContain(highlighted);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '04-find-on-week.png') });

	await page.getByTestId('find-input').press('Escape');
	await expect(findBar(page)).toHaveCount(0);
	const remaining = await page.evaluate(() => {
		const registry = (globalThis as unknown as { CSS: { highlights?: Map<string, Set<Range>> } }).CSS.highlights;
		return registry ? registry.has('chronolog-find') : false;
	});
	expect(remaining).toBe(false);
});

test('on a phone, search is reachable from the shell header', async ({ page, browserName }) => {
	const seeded = await seed(page, browserName);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await expect(page.getByTestId('mobile-search-link')).toBeVisible();
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '05-phone-header.png') });
	await page.getByTestId('mobile-search-link').click();
	await expect(page).toHaveURL(/\/search$/);
	const searchInput = page.getByTestId('global-search-input');
	await expect(searchInput).toBeFocused();
	await searchInput.fill(seeded.word);
	await searchInput.press('Enter');
	await expect(page.getByTestId('search-hit-entry')).toHaveCount(2);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '06-phone-results.png') });
	await page.getByTestId('search-hit-note').click();
	await expect(editor(page)).toContainText(`Plan ${seeded.word}`);
});
