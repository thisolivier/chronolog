/**
 * Sprint 064-DR, T1 / T2 (timesheet): the day heading bar runs edge to edge of the scroller while
 * its text keeps its place, and each entry's duration and time range end exactly under the day
 * total (within 1 px) in the wide card (container ≥ 36rem: the total is inset past the one-button
 * actions column) and the narrow card (the row actions sit before the time). The narrow card's
 * Delete still works.
 */
import { test, expect, type Page } from '@playwright/test';
import { signInAsFreshUser } from './fresh-user';
import { seedCheckpointBc } from './checkpoint-bc-seed';

async function openTimesheet(page: Page) {
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('time-entry-card').first()).toBeVisible();
}

/** Every heading's span against the scroller's inner box, and its date against its first entry */
async function measureHeadings(page: Page) {
	return page.evaluate(() => {
		const scroller = document.querySelector<HTMLElement>('[data-testid="timesheet-scroll"]')!;
		const scrollerBox = scroller.getBoundingClientRect();
		const innerLeft = scrollerBox.left + scroller.clientLeft;
		const innerRight = innerLeft + scroller.clientWidth;
		return [...document.querySelectorAll<HTMLElement>('section[data-day]')]
			.filter((section) => section.querySelector('[data-testid="time-entry-card"]'))
			.map((section) => {
				const heading = section.querySelector<HTMLElement>('[data-testid="day-heading"]')!.getBoundingClientRect();
				const date = section.querySelector<HTMLElement>('[data-testid="day-heading"] h2')!.getBoundingClientRect();
				const card = section.querySelector<HTMLElement>('[data-testid="time-entry-card"]')!;
				const cardInset = Number.parseFloat(getComputedStyle(card).paddingLeft);
				const marker = section.querySelector<HTMLElement>('[data-testid="today-marker"]')?.getBoundingClientRect() ?? null;
				return {
					day: section.dataset.day,
					leftGap: heading.left - innerLeft,
					rightGap: innerRight - heading.right,
					// The date sits over the row inset (4 px further in on today, past its marker)
					dateOffset: date.left - (card.getBoundingClientRect().left + cardInset) - (marker ? 4 : 0),
					markerLeftGap: marker ? marker.left - heading.left : null,
					markerWidth: marker ? marker.width : null
				};
			});
	});
}

/** Right edges of each entry's duration and range against its day total */
async function measureTimeAlignment(page: Page) {
	return page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('section[data-day]')].flatMap((section) => {
			const total = section.querySelector<HTMLElement>('[data-testid="day-total"]')!.getBoundingClientRect().right;
			return [...section.querySelectorAll<HTMLElement>('[data-testid="time-entry-card"]')].flatMap((card) => {
				const duration = card.querySelector<HTMLElement>('button[title="Click to edit time"]')!.getBoundingClientRect().right;
				const range = card.querySelector<HTMLElement>('[data-testid="entry-time-range"]')?.getBoundingClientRect().right;
				return [{ what: `${section.dataset.day} duration`, offBy: duration - total }].concat(
					range === undefined ? [] : [{ what: `${section.dataset.day} range`, offBy: range - total }]
				);
			});
		})
	);
}

async function expectAlignedLayout(page: Page) {
	const headings = await measureHeadings(page);
	expect(headings.length).toBeGreaterThan(0);
	for (const heading of headings) {
		expect(Math.abs(heading.leftGap), `${heading.day} bar left edge`).toBeLessThanOrEqual(1);
		expect(Math.abs(heading.rightGap), `${heading.day} bar right edge`).toBeLessThanOrEqual(1);
		expect(Math.abs(heading.dateOffset), `${heading.day} date position`).toBeLessThanOrEqual(1);
		if (heading.markerLeftGap !== null) {
			expect(Math.abs(heading.markerLeftGap), 'today marker at the bar edge').toBeLessThanOrEqual(0.5);
			expect(heading.markerWidth).toBeCloseTo(4, 0);
		}
	}
	const alignments = await measureTimeAlignment(page);
	expect(alignments.length).toBeGreaterThan(3);
	for (const alignment of alignments) expect(Math.abs(alignment.offBy), alignment.what).toBeLessThanOrEqual(1);
	// The scroller is a stacking context, so its overlay scrollbar paints above the sticky bars
	// (headless engines draw no overlay scrollbar, so the style is what can be checked)
	const scrollerIsolation = await page.getByTestId('timesheet-scroll').evaluate((scroller) => getComputedStyle(scroller).isolation);
	expect(scrollerIsolation, 'timesheet scroller stacking context').toBe('isolate');
}

const cardLayout = (page: Page) =>
	page.getByTestId('time-entry-card').first().evaluate((card) => getComputedStyle(card).gridTemplateAreas.replace(/\s+/g, ' '));

test.describe('desktop', () => {
	test('wide card: bar edge to edge, times under the day total', async ({ page, baseURL }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await signInAsFreshUser(page, baseURL, 'polish-time-wide');
		await seedCheckpointBc(page);
		await openTimesheet(page);
		expect(await cardLayout(page)).toContain('identity body time actions');
		await expectAlignedLayout(page);
	});

	test('narrow card: times under the day total, Delete still offered', async ({ page, baseURL }) => {
		await page.setViewportSize({ width: 520, height: 800 });
		await signInAsFreshUser(page, baseURL, 'polish-time-narrow');
		await seedCheckpointBc(page);
		await openTimesheet(page);
		expect(await cardLayout(page)).toContain('"identity actions time"');
		await expectAlignedLayout(page);
		const card = page.getByTestId('time-entry-card').first();
		await card.hover();
		await card.getByRole('button', { name: 'Delete entry' }).click();
		await expect(card.getByText('Delete?')).toBeVisible();
		await card.getByRole('button', { name: 'No', exact: true }).click();
		await expect(card.getByText('Delete?')).toHaveCount(0);
	});
});

test('phone: bar edge to edge, times under the day total @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(!testInfo.project.name.startsWith('iphone'), 'iPhone projects only');
	await signInAsFreshUser(page, baseURL, 'polish-time-phone');
	await seedCheckpointBc(page);
	await openTimesheet(page);
	expect(await cardLayout(page)).toContain('"identity actions time"');
	await expectAlignedLayout(page);
	// Touch: the row's Delete is always visible and at least 32 px
	const deleteBox = (await page.getByTestId('time-entry-card').first().getByRole('button', { name: 'Delete entry' }).boundingBox())!;
	expect(deleteBox.width).toBeGreaterThanOrEqual(32);
});
