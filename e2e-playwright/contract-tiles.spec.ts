/**
 * Contract pattern tiles (sprint 063-DR, design r1 DS-02 / DS-03 / DS-04 / DS-07).
 * - One tile per contract everywhere: the sidebar row, the notes list and editor headers, the
 *   timer, search and the week all draw the same motif (`data-tile`) for a contract.
 * - The quiet repeat: only on the selected sidebar row, the one-contract notes list header and the
 *   desktop note editor header (filled to the actions since 064-DR); decorative (`aria-hidden`),
 *   the small tile size, cut by a CSS mask.
 * - The timer header region is the large tile cropped at 1.5 tile widths.
 * Screenshots for the owner (sprint-screenshots.ts; UPDATE_SPRINT_SCREENSHOTS=1 writes them into
 * docs/review/screenshots/sprint-063-DR/): chromium for desktop and the contact sheet, iphone-15
 * for the phone.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { seedCheckpointBc, startTimerEarlier } from './checkpoint-bc-seed';
import { sprintScreenshotDirectory } from './sprint-screenshots';
import { TILE_MOTIFS, tileIndexForContract, tileMaskStyle } from '../src/lib/components/identity/tile-library';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-063-DR');
const sidebar = (page: Page) => page.getByTestId('sidebar-scroll');
const sidebarRow = (page: Page, contractId: string) => sidebar(page).locator(`button[data-contract-id="${contractId}"]`);

/** The mask image a browser computed (WebKit may only expose the prefixed property) */
const maskImageOf = (locator: Locator) =>
	locator.evaluate((element) => {
		const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitMaskImage?: string };
		return style.maskImage && style.maskImage !== 'none' ? style.maskImage : (style.webkitMaskImage ?? 'none');
	});

/** The motif every surface must draw for a contract (the shared hash) */
const tileFor = (contractId: string) => TILE_MOTIFS[tileIndexForContract(contractId)].id;
/** The tile a contract's sidebar row draws */
const sidebarTile = (page: Page, contractId: string) => sidebarRow(page, contractId).getByTestId('contract-mark').getAttribute('data-tile');

async function shot(page: Page, name: string, target?: Locator) {
	await page.waitForTimeout(300);
	await (target ?? page).screenshot({ path: path.join(SCREENSHOTS, name) });
}

test('a contract draws one tile on every surface; the quiet repeats sit where DS-04 puts them', async ({ page, baseURL }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1280, height: 800 });
	await signInAsFreshUser(page, baseURL, 'contract-tiles');
	const data = await seedCheckpointBc(page);
	await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
	await page.waitForLoadState('networkidle');

	// Sidebar: the selected row's tile, no initials text, a mask cut from the client colour
	const selectedRow = sidebarRow(page, data.hungryrootId);
	await expect(selectedRow).toHaveAttribute('aria-current', 'page');
	const mark = selectedRow.getByTestId('contract-mark');
	const tile = await mark.getAttribute('data-tile');
	expect(tile).toBe(tileFor(data.hungryrootId));
	await expect(mark).toHaveText('');
	expect(await maskImageOf(mark.locator('span'))).toContain('data:image/svg+xml');

	// The quiet repeat: selected row only, same motif, decorative, small tile height, before the count
	const rowRepeat = selectedRow.getByTestId('contract-tile-repeat');
	await expect(rowRepeat).toHaveAttribute('data-tile', tile!);
	await expect(rowRepeat).toHaveAttribute('aria-hidden', 'true');
	await expect(rowRepeat).toHaveText('');
	expect(await maskImageOf(rowRepeat)).toContain('data:image/svg+xml');
	const repeatBox = (await rowRepeat.boundingBox())!;
	// Whole-px tiles (no WebKit seams): the repeat's height and its mask tile size are integers
	expect(Number.isInteger(repeatBox.height)).toBe(true);
	expect(Math.round(repeatBox.height)).toBe(16);
	const repeatMaskSize = await rowRepeat.evaluate((element) => {
		const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitMaskSize?: string };
		return style.maskSize || style.webkitMaskSize || '';
	});
	expect(repeatMaskSize).toMatch(/^16px( 16px)?$/);
	expect(repeatBox.width).toBeGreaterThan(16);
	const countBox = (await selectedRow.getByTestId('sidebar-note-count').boundingBox())!;
	expect(repeatBox.x + repeatBox.width).toBeLessThanOrEqual(countBox.x);
	// The repeat swallows one row gap: its box starts at the name's edge (the gap is its padding), so
	// squeezed to nothing it leaves one gap between the name and the count, not two
	const nameBox = (await selectedRow.locator('span.truncate').first().boundingBox())!;
	expect(Math.abs(repeatBox.x - (nameBox.x + nameBox.width))).toBeLessThanOrEqual(0.5);
	await expect(sidebarRow(page, data.dailyPayId).getByTestId('contract-tile-repeat')).toHaveCount(0);
	await expect(sidebar(page).getByTestId('contract-tile-repeat')).toHaveCount(1);

	// Notes list header and editor header repeat the same tile; the editor's mark matches too
	await expect(page.getByTestId('note-list-header').getByTestId('contract-tile-repeat')).toHaveAttribute('data-tile', tile!);
	const editorHeader = page.getByTestId('note-editor-header');
	await expect(editorHeader.getByTestId('contract-mark')).toHaveAttribute('data-tile', tile!);
	await expect(editorHeader.getByTestId('contract-tile-repeat')).toHaveAttribute('data-tile', tile!);
	// The repeat never squeezes the actions: the ellipsis stays fully on the row
	const actionsBox = (await editorHeader.getByRole('button', { name: /note actions/i }).boundingBox())!;
	const editorRepeatBox = (await editorHeader.getByTestId('contract-tile-repeat').boundingBox())!;
	expect(editorRepeatBox.x + editorRepeatBox.width).toBeLessThanOrEqual(actionsBox.x);

	// Another contract has its own deterministic tile, the same in the sidebar and in search
	const rankTile = await sidebarTile(page, data.rankGroupId);
	expect(rankTile).toBe(tileFor(data.rankGroupId));

	// Timer: the 1.5:1 pattern region at the large tile size, then the small mark when compact
	await startTimerEarlier(page, data.hungryrootId, 24, 'Follow-up notes');
	await page.reload();
	await page.waitForLoadState('networkidle');
	const timerMark = page.getByTestId('timer-widget-sidebar').getByTestId('timer-identity').getByTestId('contract-mark');
	await expect(timerMark).toHaveAttribute('data-tile', tile!);
	const timerBox = (await timerMark.boundingBox())!;
	expect(Math.round(timerBox.height)).toBe(28);
	expect(Math.round(timerBox.width)).toBe(42);
	await page.getByTestId('timer-collapse-toggle').click();
	const compactMark = page.getByTestId('timer-compact').getByTestId('contract-mark');
	await expect(compactMark).toHaveAttribute('data-tile', tile!);
	expect(Math.round((await compactMark.boundingBox())!.width)).toBe(16);
	await page.getByTestId('timer-collapse-toggle').click();

	// Search rows: the compact mark only, no repeat
	await page.goto('/search?q=pricing');
	await page.waitForLoadState('networkidle');
	const hit = page.getByTestId('search-hit-note').first();
	await expect(hit.getByTestId('contract-mark')).toHaveAttribute('data-tile', rankTile!);
	await expect(hit.getByTestId('contract-tile-repeat')).toHaveCount(0);

	// The week: compact marks on time-entry rows, no repeat on them
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	const entryRows = page.getByTestId('time-entry-card');
	await expect(entryRows.first()).toBeVisible();
	await expect(entryRows.getByTestId('contract-tile-repeat')).toHaveCount(0);
	// Every row draws its own contract's tile, the one its sidebar row draws
	const contractIdByName: Record<string, string> = {
		Hungryroot: data.hungryrootId,
		'Daily Pay': data.dailyPayId,
		'Rank Group': data.rankGroupId,
		'Crew Rostering': data.easyJetContractId,
		General: data.generalContractId
	};
	const sidebarTiles: Record<string, string | null> = {};
	for (const [name, contractId] of Object.entries(contractIdByName)) sidebarTiles[name] = await sidebarTile(page, contractId);
	const rowCount = await entryRows.count();
	expect(rowCount).toBeGreaterThan(5);
	for (let index = 0; index < rowCount; index += 1) {
		const row = entryRows.nth(index);
		const contractName = (await row.getByTestId('entry-contract-name').textContent())!.trim();
		expect(sidebarTiles[contractName], contractName).toBe(tileFor(contractIdByName[contractName]));
		await expect(row.getByTestId('contract-mark')).toHaveAttribute('data-tile', sidebarTiles[contractName]!);
	}
});

test("the header pill shows the running capture's tile, not the open note's", async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'contract-tiles-pill');
	const data = await seedCheckpointBc(page);
	await startTimerEarlier(page, data.rankGroupId, 12, 'Pricing call');
	// Single-column layout above the 420 px cut-off, so the pill shows and keeps its mark; the page
	// opens straight on a note, so the pill is fed by the timer reflection (no widget mounted yet)
	await page.setViewportSize({ width: 600, height: 900 });
	await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
	await page.waitForLoadState('networkidle');
	const pill = page.getByTestId('timer-indicator');
	await expect(pill).toBeVisible();
	await expect(pill.getByTestId('contract-mark')).toHaveAttribute('data-tile', tileFor(data.rankGroupId));
	await expect(page.getByTestId('note-editor-header').getByTestId('contract-mark')).toHaveAttribute('data-tile', tileFor(data.hungryrootId));
	// …and the same tiles the sidebar draws for those contracts
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
	await page.waitForLoadState('networkidle');
	expect(await sidebarTile(page, data.rankGroupId)).toBe(tileFor(data.rankGroupId));
	expect(await sidebarTile(page, data.hungryrootId)).toBe(tileFor(data.hungryrootId));
});

test('no header repeat in the all-notes view; the repeat gives way at a narrow width', async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'contract-tiles-scope');
	const data = await seedCheckpointBc(page);
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('/notes/all');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('note-list-header')).toBeVisible();
	await expect(page.getByTestId('note-list-header').getByTestId('contract-tile-repeat')).toHaveCount(0);

	// Narrow desktop: the editor header keeps its code, Saved and actions; the repeat shrinks first
	await page.setViewportSize({ width: 820, height: 700 });
	await page.goto(`/notes/${data.rankGroupId}/${data.rankGroupNoteId}`);
	await page.waitForLoadState('networkidle');
	const editorHeader = page.getByTestId('note-editor-header');
	await expect(editorHeader.getByRole('button', { name: /note actions/i })).toBeInViewport({ ratio: 1 });
	const actionsBox = (await editorHeader.getByRole('button', { name: /note actions/i }).boundingBox())!;
	const repeat = editorHeader.getByTestId('contract-tile-repeat');
	await expect(repeat).toHaveCount(1);
	const repeatBox = (await repeat.boundingBox()) ?? { x: actionsBox.x, width: 0 };
	expect(repeatBox.x + repeatBox.width).toBeLessThanOrEqual(actionsBox.x);
	// No ten-tile cap since 064-DR (N1): it fills the row up to one gap before the actions
	expect(actionsBox.x - (repeatBox.x + repeatBox.width)).toBeLessThanOrEqual(12.5);
});

test('owner screenshots: desktop surfaces and the motif contact sheet', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'chromium only');
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1280, height: 800 });
	await signInAsFreshUser(page, baseURL, 'contract-tiles-shots');
	const data = await seedCheckpointBc(page);
	await startTimerEarlier(page, data.hungryrootId, 24, 'Follow-up notes');

	await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('note-editor-header').getByTestId('contract-tile-repeat')).toBeVisible();
	await shot(page, 'desktop-01-notes-sidebar-list-editor.png');
	await shot(page, 'desktop-02-sidebar-selected-contract.png', sidebar(page));
	await shot(page, 'desktop-03-timer-expanded-running.png', page.getByTestId('timer-widget-sidebar'));
	await shot(page, 'desktop-04-notes-list-header.png', page.getByTestId('note-list-header'));
	await shot(page, 'desktop-05-note-editor-header.png', page.getByTestId('note-editor-header'));
	await page.getByTestId('timer-collapse-toggle').click();
	await shot(page, 'desktop-06-timer-compact.png', page.getByTestId('timer-widget-sidebar'));
	await page.getByTestId('timer-collapse-toggle').click();

	await page.goto('/search?q=amplitude');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('search-hit-note').first()).toBeVisible();
	await page.getByTestId('global-search-input').blur();
	await shot(page, 'desktop-07-search-results.png');

	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('time-entry-card').first()).toBeVisible();
	await shot(page, 'desktop-08-weekly-review.png');

	// Contact sheet: every motif at 16 px and 28 px in two client colours, plus a quiet repeat,
	// drawn with the app's own mask style and colour tokens (no route ships for it)
	const cells = TILE_MOTIFS.map(
		(motif, index) => `<div style="display:flex;align-items:center;gap:8px;width:300px;font:12px system-ui;color:var(--color-ink)">
			<span style="display:block;flex:none;width:16px;height:16px;border-radius:var(--radius-mark);background:var(--color-id-juniper);${tileMaskStyle(index, '16px', 'no-repeat')}"></span>
			<span style="display:block;flex:none;width:16px;height:16px;border-radius:var(--radius-mark);background:var(--color-id-rust);${tileMaskStyle(index, '16px', 'no-repeat')}"></span>
			<span style="display:block;flex:none;width:28px;height:28px;border-radius:var(--radius-mark);background:var(--color-id-juniper);${tileMaskStyle(index, '28px', 'no-repeat')}"></span>
			<span style="display:block;flex:none;width:28px;height:28px;border-radius:var(--radius-mark);background:var(--color-id-rust);${tileMaskStyle(index, '28px', 'no-repeat')}"></span>
			<span style="display:block;flex:none;width:72px;height:16px;opacity:var(--opacity-tile-repeat);background:var(--color-id-juniper);${tileMaskStyle(index, '16px', 'repeat-x')}"></span>
			<span>${index} ${motif.id}</span></div>`
	).join('');
	await page.evaluate((html) => {
		document.body.innerHTML = `<div id="contact-sheet" style="display:flex;flex-wrap:wrap;gap:12px 16px;padding:16px;width:960px;background:var(--color-canvas)">${html}</div>`;
	}, cells);
	await shot(page, 'contact-sheet-all-motifs.png', page.locator('#contact-sheet'));
});

test('phone: sidebar and timer with tiles @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== 'iphone-15', 'iphone-15 only');
	test.setTimeout(90_000);
	await signInAsFreshUser(page, baseURL, 'contract-tiles-phone');
	const data = await seedCheckpointBc(page);
	await startTimerEarlier(page, data.hungryrootId, 24, 'Follow-up notes');

	// The phone's first screen is the sidebar, with the timer widget on it
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(sidebar(page).getByTestId('contract-mark').first()).toBeVisible();
	const hungryrootTile = await sidebarTile(page, data.hungryrootId);
	expect(hungryrootTile).toBe(tileFor(data.hungryrootId));
	await expect(page.getByTestId('timer-widget-sidebar').getByTestId('contract-mark')).toHaveAttribute('data-tile', hungryrootTile!);
	await shot(page, 'phone-01-sidebar-and-timer.png');

	// Single column editor: the repeat is left out (Saved and the ellipsis sit on different rows)
	await page.goto(`/notes/${data.hungryrootId}/${data.longNoteId}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('note-editor-header').getByTestId('contract-mark')).toBeVisible();
	await expect(page.getByTestId('note-editor-header').getByTestId('contract-tile-repeat')).toHaveCount(0);
	await shot(page, 'phone-02-note-editor.png');

	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('timer-indicator').click();
	const screen = page.getByTestId('phone-capture-screen');
	await expect(screen.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
	await expect(screen.getByTestId('contract-mark').first()).toHaveAttribute('data-tile', hungryrootTile!);
	await shot(page, 'phone-03-timer-running.png');
});
