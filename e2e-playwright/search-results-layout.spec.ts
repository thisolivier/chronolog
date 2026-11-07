/**
 * Sprint 046-CL: /search shows notes and time entries in one list, each with a type icon ("Note" /
 * "Time entry") and its client / contract; nothing scrolls sideways at phone width. Hits still open
 * their note or entry.
 *
 * Since 059-DR (SR-02) a row reads title first (beside the type icon), then the contract mark with
 * "Client / Contract", then the excerpt; the date sits at the right on desktop and beneath the
 * excerpt on a phone.
 *
 * Since 058-DR (design r1 SR-02/SR-03) the list is ordered by the shared search rank, then newest
 * first within a rank; it is no longer plain newest-first.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { editor } from './notes-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-046');

type Seeded = { word: string; clientName: string; contractName: string; otherClientName: string; noteIds: Record<string, string> };

/**
 * Two clients. Three notes written now under the first (a backdated note keeps today's last-modified
 * time, which is what the page shows and breaks rank ties by): the kick-off and workshop notes have
 * the word in their title (rank TITLE), the follow-up only in its body (rank CONTENT). Entries under
 * the second have the word in their description (rank CONTENT), dated 2099-01-05 (newer than any
 * run), Oct 22 and Oct 20. Expected order, independent of the clock:
 *   workshop, kick-off (TITLE, the later-written first), then within CONTENT newest first:
 *   2099 entry, follow-up note, Oct 22 entry, Oct 20 entry.
 * The 2099 entry shows rank beats recency (it is the newest hit but sits below the title matches)
 * and that a rank still interleaves notes and entries by recency.
 */
async function seed(page: Page, browserName: string): Promise<Seeded> {
	const suffix = `${Math.random().toString(36).slice(2, 5)}${browserName.slice(0, 1)}`;
	const word = `quokka${Date.now().toString(36).slice(-4)}${suffix}`;
	await page.goto('/');
	return page.evaluate(
		async ({ word, suffix }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url} ${response.status} ${await response.text()}`);
				return response.json();
			};
			const contracts = await (await fetch('/api/contracts')).json();
			const clientId = contracts[0].clientId;
			const clientName = contracts[0].clientName ?? '';
			const contract = await post('/api/contracts', { clientId, name: `Platform review ${suffix}`, isActive: true });
			const otherClient = await post('/api/clients', { name: `Harbour Trust ${suffix}`, shortCode: `HT${suffix.toUpperCase()}` });
			const otherContract = await post('/api/contracts', { clientId: otherClient.client.id, name: `Grant bid ${suffix}`, isActive: true });
			const noteIds: Record<string, string> = {};
			for (const [key, createdAt, title] of [
				['kickoff', '2026-10-19', `Kick-off notes ${word}`],
				['workshop', '2026-10-21', `Workshop ${word} actions`],
				['followUp', null, `Follow-up on the scope`]
			] as const) {
				const { note } = await post('/api/notes', {
					contractId: (contract.contract ?? contract).id,
					title,
					content: `# ${title}\n\nWe agreed the ${word} scope and the next steps with the team.\n`,
					...(createdAt ? { createdAt } : {})
				});
				noteIds[key] = note.id;
			}
			for (const [date, startTime, description] of [
				['2099-01-05', '09:00', `Reviewed the ${word} feedback`],
				['2026-10-20', '09:00', `Call about ${word} rollout`],
				['2026-10-22', '08:00', `Drafted the ${word} budget section`]
			]) {
				await post('/api/time-entries', { contractId: (otherContract.contract ?? otherContract).id, date, startTime, durationMinutes: 90, description });
			}
			return {
				word,
				clientName,
				contractName: `Platform review ${suffix}`,
				otherClientName: `Harbour Trust ${suffix}`,
				noteIds
			};
		},
		{ word, suffix }
	);
}

const hits = (page: Page) => page.locator('[data-search-hit]');

const noteHit = (page: Page, title: string) => page.getByTestId('search-hit-note').filter({ hasText: title });

async function expectInterleaved(page: Page, seeded: Seeded) {
	await expect(hits(page)).toHaveCount(6);
	const kinds = await hits(page).evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-search-hit')));
	expect(kinds).toEqual(['note', 'note', 'entry', 'note', 'entry', 'entry']);
	await expect(hits(page).nth(0)).toContainText('Workshop');
	await expect(hits(page).nth(1)).toContainText('Kick-off notes');
	await expect(hits(page).nth(2)).toContainText('Reviewed the');
	await expect(hits(page).nth(3)).toContainText('Follow-up on the scope');
	await expect(hits(page).nth(4)).toContainText('Drafted the');
	await expect(hits(page).nth(5)).toContainText('Call about');
	await expect(page.getByTestId('search-summary')).toHaveText('3 notes · 3 time entries');
	// Type icons with accessible labels, and the client / contract on every hit
	await expect(page.getByRole('img', { name: 'Note', exact: true })).toHaveCount(3);
	await expect(page.getByRole('img', { name: 'Time entry', exact: true })).toHaveCount(3);
	await expect(noteHit(page, 'Follow-up on').getByTestId('search-hit-context')).toContainText(`${seeded.clientName} / ${seeded.contractName}`);
	await expect(hits(page).nth(2).getByTestId('search-hit-context')).toContainText(`${seeded.otherClientName} / Grant bid`);
}

test('desktop: one list by rank then recency, type icon column, client and contract, hits open', async ({ page, browserName }) => {
	const seeded = await seed(page, browserName);
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto(`/search?q=${seeded.word}`);
	await expectInterleaved(page, seeded);

	// Icon in its own column; title first, then the contract mark and client/contract; date at the right
	const firstHit = noteHit(page, 'Follow-up on');
	const iconBox = await firstHit.getByTestId('search-hit-type-icon').boundingBox();
	const contextBox = await firstHit.getByTestId('search-hit-context').boundingBox();
	const titleBox = await firstHit.getByText(`Follow-up on`).boundingBox();
	const dateBox = (await firstHit.getByTestId('search-hit-date').boundingBox())!;
	expect(iconBox && contextBox && titleBox).toBeTruthy();
	expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(contextBox!.x);
	expect(titleBox!.x).toBeGreaterThanOrEqual(contextBox!.x - 1);
	expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(contextBox!.y + 1);
	await expect(firstHit.getByTestId('search-hit-context').getByTestId('contract-mark')).toBeVisible();
	expect(dateBox.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
	expect(dateBox.y).toBeLessThan(contextBox!.y);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '01-desktop-results.png'), fullPage: true });

	// Arrow keys walk the combined list in order
	await page.getByTestId('global-search-input').press('ArrowDown');
	await expect(hits(page).nth(0)).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(hits(page).nth(1)).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await expect(hits(page).nth(0)).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await expect(hits(page).nth(3)).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(hits(page).nth(4)).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await expect(hits(page).nth(3)).toBeFocused();
	const focusedNoteTitle = (await hits(page).nth(3).locator('.font-semibold').textContent())?.trim() ?? '';
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/notes\/[^/]+\/[^/]+$/);
	await expect(editor(page)).toContainText(focusedNoteTitle);

	await page.goBack();
	await expect(hits(page)).toHaveCount(6);
	await hits(page).nth(4).click();
	await expect(page).toHaveURL(/\/time\/2026-W43$/);
});

for (const width of [320, 390]) {
	test(`phone ${width}px: title first, date beneath the excerpt, no sideways scroll, hits open`, async ({ page, browserName }) => {
		const seeded = await seed(page, browserName);
		await page.setViewportSize({ width, height: 800 });
		await page.goto(`/search?q=${seeded.word}`);
		await expectInterleaved(page, seeded);

		// The icon sits beside the title; client/contract under the title; the date under the excerpt
		const firstHit = noteHit(page, 'Follow-up on');
		const iconBox = (await firstHit.getByTestId('search-hit-type-icon').boundingBox())!;
		const contextBox = (await firstHit.getByTestId('search-hit-context').boundingBox())!;
		const titleBox = (await firstHit.getByText('Follow-up on').boundingBox())!;
		const dateBox = (await firstHit.getByTestId('search-hit-date').boundingBox())!;
		expect(iconBox.y).toBeLessThan(titleBox.y + titleBox.height);
		expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(titleBox.x);
		expect(contextBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
		expect(dateBox.y).toBeGreaterThan(contextBox.y + contextBox.height);
		expect(Math.abs(dateBox.x - titleBox.x)).toBeLessThan(2);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);
		if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, `02-phone-${width}-results.png`), fullPage: true });

		await hits(page).nth(5).click();
		await expect(page).toHaveURL(/\/time\/2026-W43$/);
		await page.goBack();
		await noteHit(page, 'Kick-off notes').click();
		await expect(page).toHaveURL(new RegExp(`/notes/[^/]+/${seeded.noteIds.kickoff}$`));
		await expect(editor(page)).toContainText(`Kick-off notes ${seeded.word}`);
	});
}
