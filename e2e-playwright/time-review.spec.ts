/**
 * Sprint 057-DR: the weekly time review (design r1 TR-01..TR-08), asserted in the real UI with a
 * fresh user. Sticky day headings replace each other at the boundary; a day jump leaves the
 * heading and first entry uncovered; several Amplitude contracts keep their marks and names in
 * chronological order; inline editing keeps the row's height; Submitted changes only the status;
 * year-boundary week labels follow the Week 1 rule. Review screenshots go to
 * docs/review/screenshots/sprint-057/ with UPDATE_SPRINT_SCREENSHOTS=1.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';

test.describe.configure({ mode: 'default' });

type Seed = { monday: string; tuesday: string; wednesday: string; today: string; ccxEntryId: string; durationOnlyEntryId: string; weekKey: string };

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function open(page: Page, url: string) {
	await page.goto(url);
	await page.waitForLoadState('networkidle');
}

async function screenshot(page: Page, name: string) {
	await page.screenshot({ path: path.join(sprintScreenshotDirectory('sprint-057'), `${name}.png`), scale: 'css' });
}

/** Amplitude (three contracts), CCX (deliverables, so a missing one is cued) and EasyJet; a long Monday */
async function seedWeek(page: Page): Promise<Seed> {
	await open(page, '/');
	return page.evaluate(async () => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const dateOf = (date: Date) =>
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		const now = new Date();
		const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
		const day = (offset: number) => dateOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset));
		const amplitude = (await post('/api/clients', { name: 'Amplitude', shortCode: 'AMP', colorIndex: 1 })).client.id;
		const ccx = (await post('/api/clients', { name: 'Internal', shortCode: 'CCX', colorIndex: 0 })).client.id;
		const easyjet = (await post('/api/clients', { name: 'EasyJet', shortCode: 'EZY', colorIndex: 3 })).client.id;
		const contract = async (clientId: string, name: string) => (await post('/api/contracts', { clientId, name, isActive: true })).contract.id;
		const hungryroot = await contract(amplitude, 'Hungryroot');
		const rankGroup = await contract(amplitude, 'Rank Group');
		const dailyPay = await contract(amplitude, 'Daily Pay');
		const ccxInternal = await contract(ccx, 'CCX Internal');
		const easyjetSupport = await contract(easyjet, 'Native app support');
		const deliverable = async (contractId: string, name: string) => (await post('/api/deliverables', { contractId, name })).deliverable.id;
		const programme = await deliverable(hungryroot, 'Programme Management');
		await post('/api/work-types', { deliverableId: programme, name: 'Ad Hoc Technical Support' });
		const programmeWorkType = (await (await fetch(`/api/work-types?deliverableId=${programme}`)).json())[0].id;
		const rankProgramme = await deliverable(rankGroup, 'Programme Management');
		await deliverable(ccxInternal, 'Ikea onboarding');
		const entry = async (body: Record<string, unknown>) => (await post('/api/time-entries', body)).entry.id;
		const mondayEntries: Array<[string, string, string, string, string | null, string | null]> = [
			[hungryroot, '09:25', '10:14', 'Providing guidance on roles and permissions.', programme, programmeWorkType],
			[rankGroup, '10:20', '11:10', 'Pre kick-off sync with Simon, Kim, Liam and Jake.', rankProgramme, null],
			[dailyPay, '11:15', '12:20', 'Reviewing project limits and preparing the follow-up.', null, null],
			[hungryroot, '13:00', '13:45', 'Testing role configuration and documenting recommendations for the implementation team, with a description long enough to wrap onto a second line in the review.', programme, programmeWorkType],
			[ccxInternal, '14:10', '14:40', 'Answering Ikea questions for Liam.', null, null],
			[easyjetSupport, '15:00', '15:39', 'Native SDK implementation review.', null, null],
			[dailyPay, '15:45', '16:30', 'Dashboard walkthrough.', null, null],
			[rankGroup, '16:35', '17:20', 'Event taxonomy clean-up.', rankProgramme, null],
			[hungryroot, '17:25', '18:05', 'Permissions follow-up call.', programme, programmeWorkType]
		];
		let ccxEntryId = '';
		for (const [contractId, startTime, endTime, description, deliverableId, workTypeId] of mondayEntries) {
			const [startHours, startMinutes] = startTime.split(':').map(Number);
			const [endHours, endMinutes] = endTime.split(':').map(Number);
			const id = await entry({
				date: day(0), contractId, startTime, endTime, description, deliverableId, workTypeId,
				durationMinutes: endHours * 60 + endMinutes - (startHours * 60 + startMinutes)
			});
			if (contractId === ccxInternal) ccxEntryId = id;
		}
		const durationOnlyEntryId = await entry({ date: day(0), contractId: dailyPay, durationMinutes: 25, description: 'Expenses (no clock times).' });
		await entry({ date: day(1), contractId: hungryroot, startTime: '09:00', endTime: '10:30', durationMinutes: 90, description: 'Roles workshop.', deliverableId: programme, workTypeId: programmeWorkType });
		await entry({ date: day(1), contractId: easyjetSupport, startTime: '11:00', endTime: '12:00', durationMinutes: 60, description: 'Crash triage.' });
		await entry({ date: day(1), contractId: rankGroup, startTime: '13:00', endTime: '13:30', durationMinutes: 30, description: 'Status call.', deliverableId: rankProgramme });
		await entry({ date: day(2), contractId: dailyPay, startTime: '10:00', endTime: '11:00', durationMinutes: 60, description: 'Limits review.' });
		const me = await (await fetch('/api/me')).json();
		return { monday: day(0), tuesday: day(1), wednesday: day(2), today: dateOf(now), ccxEntryId, durationOnlyEntryId, weekKey: me.week };
	});
}

const scroller = (page: Page) => page.getByTestId('timesheet-scroll');
const heading = (page: Page, date: string) => page.locator(`[data-day="${date}"] [data-testid="day-heading"]`);

async function top(locator: Locator): Promise<number> {
	return (await locator.boundingBox())!.y;
}

async function scrollTo(page: Page, scrollTop: number) {
	await scroller(page).evaluate((element, value) => element.scrollTo({ top: value, behavior: 'auto' }), scrollTop);
	await page.waitForTimeout(100);
}

test.describe('Time review (057-DR)', () => {
	test.beforeEach(({ browserName }, testInfo) => {
		test.skip(testInfo.project.name.startsWith('iphone'), 'desktop review checks');
	});

	test('rows: mark, contract and client in chronological order; local cues; no invented range', async ({ page, baseURL }) => {
		await page.setViewportSize({ width: 1400, height: 900 });
		await signInAsFreshUser(page, baseURL, 'time-review-rows');
		const seed = await seedWeek(page);
		await open(page, '/time');

		const mondayRows = page.locator(`[data-day="${seed.monday}"] [data-testid="time-entry-card"]`);
		await expect(mondayRows).toHaveCount(10);
		// Chronology preserved: never regrouped by client
		await expect(mondayRows.getByTestId('entry-contract-name')).toHaveText([
			'Hungryroot', 'Rank Group', 'Daily Pay', 'Hungryroot', 'CCX Internal', 'Native app support', 'Daily Pay', 'Rank Group', 'Hungryroot', 'Daily Pay'
		]);
		await expect(mondayRows.first().getByTestId('entry-client-name')).toHaveText('Amplitude');
		await expect(mondayRows.first().getByTestId('contract-mark')).toHaveText('HU');
		// Same-contract rows line up: the contract name starts at the same x in every row
		const nameLefts = await mondayRows.getByTestId('entry-contract-name').evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().left)));
		expect(new Set(nameLefts).size).toBe(1);
		// No background wash on the rows
		await expect(mondayRows.first()).toHaveCSS('background-image', 'none');

		// Missing detail is local: CCX has a deliverable to choose, Rank Group a work type... none, so no cue
		const ccxRow = page.locator(`[data-entry-id="${seed.ccxEntryId}"]`);
		await expect(ccxRow.getByTestId('missing-detail-cue')).toHaveText(/Add deliverable$/);
		await expect(mondayRows.nth(1).getByTestId('missing-detail-cue')).toHaveCount(0);
		await expect(mondayRows.nth(2).getByTestId('missing-detail-cue')).toHaveCount(0); // Daily Pay has no deliverables
		await ccxRow.getByTestId('missing-detail-cue').click();
		await expect(ccxRow.locator('select').first()).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(ccxRow.getByTestId('missing-detail-cue')).toBeFocused();

		// A duration-only entry shows its duration and no time range
		const durationOnly = page.locator(`[data-entry-id="${seed.durationOnlyEntryId}"]`);
		await expect(durationOnly.getByTitle('Click to edit time')).toHaveText('25m');
		await expect(durationOnly.getByTestId('entry-time-range')).toHaveCount(0);
		await expect(mondayRows.first().getByTestId('entry-time-range')).toHaveText(/^09:25.10:14$/);

		// The strip's bar shares come from the entries: Tuesday is 90 + 30 Amplitude, 60 EasyJet
		const tuesdayShares = await page
			.getByRole('button', { name: `Go to ${seed.tuesday}` })
			.locator('[data-share]')
			.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-share')));
		expect(tuesdayShares).toEqual(['66.7', '33.3']);

		await scrollTo(page, 0);
		await screenshot(page, '01-desktop-week');
	});

	test('sticky day headings: pinned while the day scrolls, replaced at the boundary; a day jump is not covered', async ({ page, baseURL }) => {
		await page.setViewportSize({ width: 1400, height: 700 });
		await signInAsFreshUser(page, baseURL, 'time-review-sticky');
		const seed = await seedWeek(page);
		await open(page, '/time');
		await expect(heading(page, seed.monday)).toBeVisible();
		const scrollerTop = await top(scroller(page));
		const mondaySection = page.locator(`[data-day="${seed.monday}"]`);
		const mondayHeight = (await mondaySection.boundingBox())!.height;
		const mondayOffset = await mondaySection.evaluate((element) => (element as HTMLElement).offsetTop);

		// Halfway through Monday: Monday's heading is pinned at the top of the scroller
		await scrollTo(page, mondayOffset + mondayHeight / 2);
		expect(Math.abs((await top(heading(page, seed.monday))) - scrollerTop)).toBeLessThanOrEqual(1);
		await expect(heading(page, seed.monday)).toHaveCSS('border-top-left-radius', '0px');
		await screenshot(page, '02-desktop-sticky-heading');

		// Past Monday's end: Tuesday's heading has replaced it
		await scrollTo(page, mondayOffset + mondayHeight + 10);
		expect(Math.abs((await top(heading(page, seed.tuesday))) - scrollerTop)).toBeLessThanOrEqual(1);
		const mondayBottom = (await heading(page, seed.monday).boundingBox())!;
		expect(mondayBottom.y + mondayBottom.height).toBeLessThanOrEqual(scrollerTop + 1);

		// Day jump from the strip: the heading and first entry sit just below the week controls
		await scrollTo(page, 0);
		await page.getByRole('button', { name: `Go to ${seed.tuesday}` }).click();
		await expect.poll(async () => Math.round((await top(heading(page, seed.tuesday))) - scrollerTop)).toBe(0);
		const tuesdayHeadingBox = (await heading(page, seed.tuesday).boundingBox())!;
		const firstTuesdayEntry = page.locator(`[data-day="${seed.tuesday}"] [data-testid="time-entry-card"]`).first();
		expect(await top(firstTuesdayEntry)).toBeGreaterThanOrEqual(tuesdayHeadingBox.y + tuesdayHeadingBox.height - 1);
		const stripBox = (await page.getByTestId('week-strip').boundingBox())!;
		expect(tuesdayHeadingBox.y).toBeGreaterThanOrEqual(stripBox.y + stripBox.height - 1);
	});

	test('inline editing keeps the row height and its neighbours still', async ({ page, baseURL }) => {
		await page.setViewportSize({ width: 1400, height: 900 });
		await signInAsFreshUser(page, baseURL, 'time-review-edit');
		const seed = await seedWeek(page);
		await open(page, '/time');
		const rows = page.locator(`[data-day="${seed.monday}"] [data-testid="time-entry-card"]`);
		const row = rows.nth(2);
		const next = rows.nth(3);
		const measure = async () => ({
			height: Math.round((await row.boundingBox())!.height),
			nextOffset: Math.round((await top(next)) - (await top(row)))
		});
		await row.scrollIntoViewIfNeeded();
		const before = await measure();

		// Description: a textarea that keeps the text's height; Escape cancels
		await row.getByTitle('Click to edit description').click();
		const textarea = row.locator('textarea');
		await expect(textarea).toBeFocused();
		expect(await measure()).toEqual(before);
		await page.keyboard.press('Escape');
		await expect(row.getByTitle('Click to edit description')).toBeFocused();

		// Time: editor, preview line and error line all inside the row's footprint
		await row.getByTitle('Click to edit time').click();
		const timeInput = row.locator('input[type="text"]');
		await timeInput.fill('1h 5m');
		expect(await measure()).toEqual(before);
		await timeInput.fill('banana');
		await timeInput.press('Enter');
		await expect(row.getByRole('alert')).toBeVisible();
		expect(await measure()).toEqual(before);
		await screenshot(page, '03-desktop-inline-edit');
		await timeInput.press('Escape');

		// Classification: the pickers and Done replace the line without pushing the next row
		const ccxRow = page.locator(`[data-entry-id="${seed.ccxEntryId}"]`);
		const ccxBefore = Math.round((await ccxRow.boundingBox())!.height);
		await ccxRow.getByTestId('missing-detail-cue').click();
		await expect(ccxRow.getByRole('button', { name: 'Done' })).toBeVisible();
		expect(Math.round((await ccxRow.boundingBox())!.height)).toBe(ccxBefore);
		await ccxRow.getByRole('button', { name: 'Done' }).click();

		// Enter saves the description and focus returns to it
		await row.getByTitle('Click to edit description').click();
		await textarea.fill('Reviewing project limits, edited in place.');
		await textarea.press('Enter');
		await expect(row.getByTitle('Click to edit description')).toHaveText('Reviewing project limits, edited in place.');
		await expect(row.getByTitle('Click to edit description')).toBeFocused();
	});

	test('a failed description save keeps the typed text in the editor', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'time-review-fail');
		const seed = await seedWeek(page);
		await open(page, '/time');
		await page.route('**/api/time-entries/*', (route) =>
			route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{"error":"boom"}' }) : route.fallback()
		);
		const row = page.locator(`[data-day="${seed.monday}"] [data-testid="time-entry-card"]`).first();
		await row.getByTitle('Click to edit description').click();
		await row.locator('textarea').fill('Typed and not lost');
		await row.locator('textarea').press('Enter');
		await expect(row.getByRole('alert')).toContainText("Couldn't save");
		await expect(row.locator('textarea')).toHaveValue('Typed and not lost');
	});

	test('Submitted changes only the week status (recordkeeping); a failed save is shown', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'time-review-status');
		const seed = await seedWeek(page);
		await open(page, '/time');
		const total = await page.getByTestId('week-total').textContent();
		const entryCount = await page.getByTestId('time-entry-card').count();

		await page.getByRole('button', { name: /^Week status: Unsubmitted/ }).click();
		const submitted = page.getByRole('menuitemradio', { name: /Submitted/ }).last();
		await expect(submitted).toContainText('nothing is sent');
		await expect(page.getByText('Sent to the client')).toHaveCount(0);
		await submitted.click();
		await expect(page.getByRole('button', { name: /^Week status: Submitted/ })).toBeVisible();
		await expect(page.getByTestId('week-total')).toHaveText(total!);
		await expect(page.getByTestId('time-entry-card')).toHaveCount(entryCount);
		const statuses = await page.evaluate(async (weekKey) => {
			const [year, week] = weekKey.split('-W').map(Number);
			const previous = week > 1 ? `${year}-W${String(week - 1).padStart(2, '0')}` : weekKey;
			return (await (await fetch(`/api/time-entries/weekly-statuses?weeks=${weekKey},${previous}`)).json()).statuses;
		}, seed.weekKey);
		expect(statuses[seed.weekKey]).toBe('Submitted');
		expect(Object.values(statuses).filter((status) => status === 'Submitted')).toHaveLength(1);

		await page.route('**/api/time-entries/weekly-statuses', (route) =>
			route.request().method() === 'POST' ? route.fulfill({ status: 500, body: '{"error":"down"}' }) : route.fallback()
		);
		await page.getByRole('button', { name: /^Week status: Submitted/ }).click();
		await page.getByRole('menuitemradio', { name: /Draft ready/ }).click();
		await expect(page.getByTestId('week-status-error')).toContainText("Couldn't save “Draft ready”");
		await expect(page.getByRole('button', { name: /^Week status: Submitted/ })).toBeVisible();
	});

	test('year boundary: Week 1 is the week containing 1 January; old ISO-only URLs still open their week', async ({ page }) => {
		await open(page, '/time/2027-W01');
		await expect(page.getByTestId('week-heading')).toHaveText('Week 1 · 28 Dec 2026 – 3 Jan 2027');
		await expect(page.getByRole('button', { name: 'Previous week' })).toHaveAttribute('title', 'Week 52');
		await expect(page.getByRole('button', { name: 'Next week' })).toHaveAttribute('title', 'Week 2');
		await expect(page.getByRole('button', { name: 'Go to 2027-01-01' })).toBeVisible();
		await page.getByRole('button', { name: 'Previous week' }).click();
		await expect(page).toHaveURL(/\/time\/2026-W52$/);
		await expect(page.getByTestId('week-heading')).toHaveText('Week 52 · 21–27 Dec 2026');

		// An old ISO-only bookmark opens the same Monday's week
		await open(page, '/time/2026-W53');
		await expect(page.getByTestId('week-heading')).toHaveText('Week 1 · 28 Dec 2026 – 3 Jan 2027');
	});
});

test.describe('Time review on a phone (057-DR) @iphone', () => {
	test('week and day: compact strip, reflowed rows, no footer timer, no capture buttons in the week @iphone', async ({ page, baseURL }, testInfo) => {
		test.skip(!testInfo.project.name.startsWith('iphone'), 'phone layout');
		await signInAsFreshUser(page, baseURL, 'time-review-phone');
		const seed = await seedWeek(page);
		await open(page, '/time');
		await expect(page.getByTestId('time-entry-card').first()).toBeVisible();

		// No persistent bottom timer bar, and (owner change, 060-DR) no Start timer / Add Entry in the
		// week controls: the pill and the home widget give timer access, each day keeps "Add entry"
		await expect(page.getByTestId('timer-widget-footer')).toHaveCount(0);
		await expect(page.getByTestId('phone-start-timer')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Add Entry', exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Add entry for / }).first()).toBeVisible();
		const widthOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(widthOverflow).toBeLessThanOrEqual(0);

		// Each row: identity and time on one line, the description full width beneath
		const row = page.locator(`[data-day="${seed.monday}"] [data-testid="time-entry-card"]`).first();
		const nameBox = (await row.getByTestId('entry-contract-name').boundingBox())!;
		const timeBox = (await row.getByTitle('Click to edit time').boundingBox())!;
		const descriptionBox = (await row.getByTitle('Click to edit description').boundingBox())!;
		expect(Math.abs(timeBox.y - nameBox.y)).toBeLessThanOrEqual(4);
		expect(descriptionBox.y).toBeGreaterThan(nameBox.y + nameBox.height - 1);
		await page.screenshot({ path: path.join(sprintScreenshotDirectory('sprint-057'), `${testInfo.project.name}-04-week.png`), scale: 'css' });

		await page.getByRole('button', { name: `Go to ${seed.monday}` }).click();
		await expect.poll(async () => Math.round((await top(heading(page, seed.monday))) - (await top(scroller(page))))).toBe(0);
		await scrollTo(page, 260);
		await page.screenshot({ path: path.join(sprintScreenshotDirectory('sprint-057'), `${testInfo.project.name}-05-day.png`), scale: 'css' });
		expect(Math.abs((await top(heading(page, seed.monday))) - (await top(scroller(page))))).toBeLessThanOrEqual(1);
	});
});
