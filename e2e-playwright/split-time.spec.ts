/**
 * Sprint 056-DR (design r1 stage 5, UI): the desktop two-card split (SP-01..SP-08).
 * The seven acceptance scenarios of docs/design/r1/specs/04-split-time.md, as far as a browser
 * drives them, plus a failed left save, Split hidden on a phone and disabled offline or without
 * a contract. Screenshots for the review go to docs/review/screenshots/sprint-056/ with
 * UPDATE_SPRINT_SCREENSHOTS=1.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-056');

type Seeded = { contractId: string; otherContractId: string; noteId: string; deliverableId: string; workTypeId: string };

async function open(page: Page, target: string) {
	await page.goto(target);
	await page.waitForLoadState('networkidle');
}

/** Hungryroot (one deliverable, one work type: the sole-option chain) and Rank Group (several) */
async function seed(page: Page, label: string): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await open(page, '/');
	return page.evaluate(
		async ({ suffix, label }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
				return response.json();
			};
			const clientId = (await post('/api/clients', { name: `Amplitude ${label}`, shortCode: `S${suffix.slice(-5).toUpperCase()}` })).client.id;
			const contractId = (await post('/api/contracts', { clientId, name: `Hungryroot ${suffix}`, isActive: true })).contract.id;
			const otherContractId = (await post('/api/contracts', { clientId, name: `Rank Group ${suffix}`, isActive: true })).contract.id;
			const deliverableId = (await post('/api/deliverables', { contractId, name: 'Programme Management' })).deliverable.id;
			const workTypeId = (await post('/api/work-types', { deliverableId, name: 'Ad Hoc Technical Support' })).workType.id;
			await post('/api/deliverables', { contractId: otherContractId, name: 'Discovery' });
			await post('/api/deliverables', { contractId: otherContractId, name: 'Implementation', sortOrder: 1 });
			const noteId = (await post('/api/notes', { contractId, title: `Roles ${suffix}`, content: `# Roles ${suffix}` })).note.id;
			return { contractId, otherContractId, noteId, deliverableId, workTypeId };
		},
		{ suffix, label }
	);
}

/** A server timer on `contractId` started `minutesAgo` minutes ago (local clock), with a description */
async function startTimer(page: Page, contractId: string, minutesAgo: number, description = '') {
	await page.evaluate(
		async ({ contractId, minutesAgo, description }) => {
			const start = new Date(Date.now() - minutesAgo * 60_000);
			const pad = (value: number) => String(value).padStart(2, '0');
			const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
			const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}:00`;
			const response = await fetch('/api/timer/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, date, startTime, confirmed: true })
			});
			if (!response.ok) throw new Error(`start: ${response.status} ${await response.text()}`);
			const timer = await response.json();
			if (description) {
				await fetch(`/api/time-entries/${timer.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ description })
				});
			}
		},
		{ contractId, minutesAgo, description }
	);
}

type TimerStatus = { id: string; date: string; startTime: string; endTime: string | null; contractId: string; description: string | null } | null;
async function timerStatus(page: Page): Promise<TimerStatus> {
	return page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer ?? null);
}

/** Every saved (non-draft) entry from yesterday to tomorrow for this fresh user */
async function savedEntries(page: Page): Promise<{ id: string; startTime: string | null; endTime: string | null; contractId: string; description: string | null }[]> {
	return page.evaluate(async () => {
		const day = (offset: number) => {
			const moment = new Date(Date.now() + offset * 86_400_000);
			return `${moment.getFullYear()}-${String(moment.getMonth() + 1).padStart(2, '0')}-${String(moment.getDate()).padStart(2, '0')}`;
		};
		const response = await fetch(`/api/time-entries?from=${day(-1)}&to=${day(1)}`);
		const body = await response.json();
		const entries = body.entries as { id: string; isDraft?: boolean; startTime: string | null; endTime: string | null; contractId: string; description: string | null }[];
		return entries.filter((entry) => !entry.isDraft);
	});
}

const widget = (page: Page) => page.getByTestId('timer-widget-sidebar');
const overlay = (page: Page) => page.getByTestId('split-overlay');
const leftCard = (page: Page) => page.getByTestId('split-card-left');
const rightCard = (page: Page) => page.getByTestId('timer-widget-split');
const button = (scope: Locator, name: string) => scope.getByRole('button', { name, exact: true });

async function openSplit(page: Page) {
	await widget(page).getByTestId('timer-split-button').click();
	await expect(overlay(page)).toBeVisible();
	await expect(leftCard(page).locator('#split-left-contract')).toBeEnabled();
}

/** `HH:MM` of a local moment `minutesAgo` minutes before the page's now */
async function clockMinutesAgo(page: Page, minutesAgo: number): Promise<string> {
	return page.evaluate((minutesAgo) => {
		const moment = new Date(Date.now() - minutesAgo * 60_000);
		return `${String(moment.getHours()).padStart(2, '0')}:${String(moment.getMinutes()).padStart(2, '0')}`;
	}, minutesAgo);
}

test.describe('desktop split', () => {
	test.use({ viewport: { width: 1280, height: 860 } });

	test('1: the shared boundary moves both cards; durations move it from the start or back from now', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-boundary');
		const data = await seed(page, 'SB');
		await startTimer(page, data.contractId, 90, `Roles and permissions [[${data.noteId}]]`);
		await open(page, '/');
		await openSplit(page);
		await page.screenshot({ path: path.join(SCREENSHOTS, '01-two-cards-fresh.png') });

		const startClock = await clockMinutesAgo(page, 90);
		await expect(leftCard(page).getByTestId('split-left-from')).toHaveValue(startClock);
		await expect(rightCard(page).getByTestId('split-right-to')).toHaveValue('Now');
		await expect(leftCard(page).locator('#split-left-description')).toHaveValue(`Roles and permissions [[${data.noteId}]]`);
		await expect(rightCard(page).locator('#split-right-description')).toHaveValue('');
		await expect(page.getByRole('button', { name: 'Flip' })).toBeVisible();
		await expect(button(overlay(page), 'Cancel')).toBeVisible();

		// Left To → right From
		const boundaryClock = await clockMinutesAgo(page, 40);
		await leftCard(page).getByTestId('split-left-to').fill(boundaryClock);
		await expect(rightCard(page).getByTestId('split-right-from')).toHaveValue(boundaryClock);
		await expect(leftCard(page).getByTestId('split-left-duration')).toHaveValue('50m');
		// Right From → left To
		const laterClock = await clockMinutesAgo(page, 30);
		await rightCard(page).getByTestId('split-right-from').fill(laterClock);
		await expect(leftCard(page).getByTestId('split-left-to')).toHaveValue(laterClock);
		// A left duration moves the boundary from the start
		await leftCard(page).getByTestId('split-left-duration').fill('45m');
		await leftCard(page).getByTestId('split-left-duration').press('Enter');
		await expect(rightCard(page).getByTestId('split-right-from')).toHaveValue(await clockMinutesAgo(page, 45));
		await page.screenshot({ path: path.join(SCREENSHOTS, '02-after-boundary-edit.png') });
		// A right duration moves it back from now, once: the start then stays while time passes
		await rightCard(page).getByTestId('split-right-duration').fill('20m');
		await rightCard(page).getByTestId('split-right-duration').press('Enter');
		const confirmedFrom = await rightCard(page).getByTestId('split-right-from').inputValue();
		expect([await clockMinutesAgo(page, 20), await clockMinutesAgo(page, 21)]).toContain(confirmedFrom);
		await page.waitForTimeout(2200);
		await expect(rightCard(page).getByTestId('split-right-from')).toHaveValue(confirmedFrom);
		await expect(leftCard(page).getByTestId('split-left-to')).toHaveValue(confirmedFrom);
		// Zero and negative parts are refused inline
		await leftCard(page).getByTestId('split-left-duration').fill('0');
		await leftCard(page).getByTestId('split-left-duration').press('Enter');
		await expect(leftCard(page).getByTestId('split-left-times-error')).toBeVisible();
		await leftCard(page).getByTestId('split-left-to').fill(await clockMinutesAgo(page, 95));
		await expect(leftCard(page).getByTestId('split-left-times-error')).toContainText('must end after it starts');
		await button(leftCard(page), 'Save').click();
		await expect(leftCard(page).getByTestId('split-left-error')).toBeVisible();
		expect((await timerStatus(page))?.startTime.slice(0, 5)).toBe(startClock);
	});

	test('2 and 4: Flip moves content not times; a saved left stays as saved when the right start changes', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-flip');
		const data = await seed(page, 'SF');
		const description = `Roles and permissions [[${data.noteId}]]`;
		await startTimer(page, data.contractId, 90, description);
		await open(page, '/');
		await openSplit(page);
		await expect(leftCard(page).locator('#split-left-work-type')).toHaveValue(data.workTypeId);
		const fromBefore = await leftCard(page).getByTestId('split-left-from').inputValue();
		const boundaryBefore = await leftCard(page).getByTestId('split-left-to').inputValue();

		await page.getByRole('button', { name: 'Flip' }).click();
		await expect(rightCard(page).locator('#split-right-description')).toHaveValue(description);
		// The link reads as rendered text, not [[id]], until the field is clicked (060-DR)
		await expect(rightCard(page).getByTestId('split-right-description-rendered')).not.toContainText('[[');
		// The link is text inside the button (no nested buttons, no tab stops): clicking its title opens the field
		const rendered = rightCard(page).getByTestId('split-right-description-rendered');
		await expect(rendered.locator('button')).toHaveCount(0);
		await rendered.locator('[data-wiki-link-text]').click();
		await expect(rightCard(page).locator('#split-right-description')).toBeVisible();
		await expect(rightCard(page).locator('#split-right-description')).toBeFocused();
		await expect(rightCard(page).locator('#split-right-description')).toHaveValue(description);
		await expect(rightCard(page).locator('#split-right-contract')).toHaveValue(data.contractId);
		await expect(rightCard(page).locator('#split-right-work-type')).toHaveValue(data.workTypeId);
		await expect(leftCard(page).locator('#split-left-description')).toHaveValue('');
		await expect(leftCard(page).locator('#split-left-contract')).not.toHaveValue(data.contractId);
		await expect(leftCard(page).getByTestId('split-left-from')).toHaveValue(fromBefore);
		await expect(leftCard(page).getByTestId('split-left-to')).toHaveValue(boundaryBefore);
		await expect(rightCard(page).getByTestId('split-right-to')).toHaveValue('Now');
		await page.screenshot({ path: path.join(SCREENSHOTS, '03-after-flip.png') });

		// The left (now blank) part: Rank Group, then Save
		await leftCard(page).locator('#split-left-description').fill('Kick-off call');
		await leftCard(page).locator('#split-left-contract').selectOption(data.otherContractId);
		const rightBoxBefore = await rightCard(page).boundingBox();
		const leftBoxBefore = await leftCard(page).boundingBox();
		await button(leftCard(page), 'Save').click();
		await expect(leftCard(page).getByTestId('split-left-summary')).toBeVisible();
		await expect(leftCard(page).getByTestId('split-left-summary-range')).toHaveText(`${fromBefore}–${boundaryBefore}`);
		await expect(page.getByRole('button', { name: 'Flip' })).toHaveCount(0);
		// SP-04 same footprint (060-DR): the right card does not move; the summary keeps the left
		// card's width and shrinks to its content
		const rightBoxAfter = await rightCard(page).boundingBox();
		const leftBoxAfter = await leftCard(page).boundingBox();
		expect(Math.abs((rightBoxAfter?.x ?? 0) - (rightBoxBefore?.x ?? 0))).toBeLessThanOrEqual(1);
		expect(Math.abs((rightBoxAfter?.y ?? 0) - (rightBoxBefore?.y ?? 0))).toBeLessThanOrEqual(1);
		expect(Math.abs((leftBoxAfter?.width ?? 0) - (leftBoxBefore?.width ?? 0))).toBeLessThanOrEqual(1);
		expect(leftBoxAfter?.height ?? 0).toBeLessThan((leftBoxBefore?.height ?? 0) - 100);
		await expect(button(overlay(page), 'Cancel')).toHaveCount(0);
		await expect(button(rightCard(page), 'Resume')).toBeEnabled();
		await page.screenshot({ path: path.join(SCREENSHOTS, '04-after-left-save.png') });

		const leftEntries = await savedEntries(page);
		expect(leftEntries).toHaveLength(1);
		expect(leftEntries[0].contractId).toBe(data.otherContractId);
		expect(leftEntries[0].endTime?.slice(0, 5)).toBe(boundaryBefore);
		const remainder = await timerStatus(page);
		expect(remainder?.startTime.slice(0, 5)).toBe(boundaryBefore);
		expect(remainder?.description).toBe(description);

		// The right start cannot move back over the saved part: it stops at the saved end
		await rightCard(page).getByTestId('split-right-from').fill(await clockMinutesAgo(page, 60));
		await expect(rightCard(page).getByTestId('split-right-from')).toHaveValue(boundaryBefore);
		// Editing the right start after the left is saved never rewrites the saved part
		await rightCard(page).getByTestId('split-right-from').fill(await clockMinutesAgo(page, 20));
		await expect(leftCard(page).getByTestId('split-left-summary-range')).toHaveText(`${fromBefore}–${boundaryBefore}`);
		// Escape and the backdrop do nothing now
		await page.keyboard.press('Escape');
		await overlay(page).click({ position: { x: 5, y: 400 } });
		await expect(overlay(page)).toBeVisible();
		await button(rightCard(page), 'Save').click();
		await expect(overlay(page)).toHaveCount(0);
		const finalEntries = await savedEntries(page);
		expect(finalEntries).toHaveLength(2);
		expect(finalEntries.find((saved) => saved.id === leftEntries[0].id)?.endTime?.slice(0, 5)).toBe(boundaryBefore);
		expect(await timerStatus(page)).toBeNull();
	});

	test('3 and 5: right actions wait for the left; Stop works before; Resume continues from the right start', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-resume');
		const data = await seed(page, 'SR');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		await openSplit(page);
		await rightCard(page).locator('#split-right-description').fill('Follow-up');
		for (const name of ['Save', 'Discard', 'Resume']) {
			await expect(button(rightCard(page), name)).toBeDisabled();
		}
		await expect(rightCard(page).getByTestId('split-right-reason')).toHaveText('Finish the first part to continue');

		// Stop works before the left is resolved: the live end freezes, nothing is saved
		await button(rightCard(page), 'Stop').click();
		await expect(button(rightCard(page), 'Stop')).toHaveCount(0);
		await expect(rightCard(page).getByTestId('split-right-to')).not.toHaveValue('Now');
		expect((await timerStatus(page))?.endTime).toBeTruthy();
		expect(await savedEntries(page)).toHaveLength(0);
		// An edited To stays in the card; the split still checks the server's own end
		await rightCard(page).getByTestId('split-right-to').fill(await clockMinutesAgo(page, 2));

		await button(leftCard(page), 'Save').click();
		await expect(leftCard(page).getByTestId('split-left-summary')).toBeVisible();
		await expect(rightCard(page).getByTestId('split-right-to')).toHaveValue(await clockMinutesAgo(page, 2));
		const rightFrom = await rightCard(page).getByTestId('split-right-from').inputValue();
		await expect(button(rightCard(page), 'Resume')).toBeEnabled();
		await rightCard(page).locator('#split-right-contract').selectOption(data.contractId);
		await page.screenshot({ path: path.join(SCREENSHOTS, '05-right-stopped-with-resume.png') });
		await button(rightCard(page), 'Resume').click();
		await expect(overlay(page)).toHaveCount(0);
		const resumed = await timerStatus(page);
		expect(resumed?.endTime).toBeNull();
		expect(resumed?.startTime.slice(0, 5)).toBe(rightFrom);
		expect(resumed?.description).toBe('Follow-up');
		await expect(widget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await expect(widget(page).locator('#draft-description')).toHaveValue('Follow-up');
	});

	test('6: Cancel after Stop restores one unsplit stopped completion, not a running timer', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-cancel');
		const data = await seed(page, 'SC');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		const original = await timerStatus(page);
		await openSplit(page);
		await leftCard(page).locator('#split-left-description').fill('Changed in the split');
		await button(rightCard(page), 'Stop').click();
		await expect(button(rightCard(page), 'Stop')).toHaveCount(0);
		await button(overlay(page), 'Cancel').click();
		await expect(overlay(page)).toHaveCount(0);
		await expect(widget(page).getByTestId('timer-completion-form')).toBeVisible();
		await expect(widget(page).locator('#timer-description')).toHaveValue('Planning');
		const after = await timerStatus(page);
		expect(after?.startTime).toBe(original?.startTime);
		expect(after?.endTime).toBeTruthy();
		expect(await savedEntries(page)).toHaveLength(0);

		// From the stopped form, Escape cancels too (and nothing restarts)
		await widget(page).getByTestId('timer-split-button').click();
		await expect(overlay(page)).toBeVisible();
		await expect(button(rightCard(page), 'Stop')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(overlay(page)).toHaveCount(0);
		expect((await timerStatus(page))?.endTime).toBe(after?.endTime);
	});

	test('a failed left save keeps everything editable and commits nothing', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-fail');
		const data = await seed(page, 'SX');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		const original = await timerStatus(page);
		await openSplit(page);
		await page.route('**/api/timer/split', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Database unavailable', code: 'invalid_split' }) }));
		await button(leftCard(page), 'Save').click();
		await expect(leftCard(page).getByTestId('split-left-error')).toContainText('Database unavailable');
		// A definitive 4xx: nothing was written, the marker is gone
		expect(await page.evaluate(() => localStorage.getItem('chronolog.split-marker'))).toBeNull();
		await expect(leftCard(page).locator('#split-left-description')).toHaveValue('Planning');
		await expect(button(leftCard(page), 'Retry')).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Flip' })).toBeVisible();
		await expect(button(overlay(page), 'Cancel')).toBeVisible();
		await expect(button(rightCard(page), 'Resume')).toBeDisabled();
		expect((await timerStatus(page))?.startTime).toBe(original?.startTime);
		expect(await savedEntries(page)).toHaveLength(0);
		await page.unroute('**/api/timer/split');
		await button(leftCard(page), 'Retry').click();
		await expect(leftCard(page).getByTestId('split-left-summary')).toBeVisible();
		expect(await savedEntries(page)).toHaveLength(1);
	});

	test('an edited start is moved back when the split fails and the user cancels', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-start-back');
		const data = await seed(page, 'SS');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		const original = await timerStatus(page);
		await openSplit(page);
		await leftCard(page).getByTestId('split-left-from').fill(await clockMinutesAgo(page, 50));
		// A 502 may follow a commit: the marker stays and Retry is offered
		await page.route('**/api/timer/split', (route) => route.fulfill({ status: 502, body: 'Bad gateway' }));
		await button(leftCard(page), 'Save').click();
		await expect(button(leftCard(page), 'Retry')).toBeEnabled();
		expect(await page.evaluate(() => localStorage.getItem('chronolog.split-marker'))).toBeTruthy();
		expect((await timerStatus(page))?.startTime).not.toBe(original?.startTime);
		await page.unroute('**/api/timer/split');
		await button(overlay(page), 'Cancel').click();
		await expect(overlay(page)).toHaveCount(0);
		await expect.poll(async () => (await timerStatus(page))?.startTime).toBe(original?.startTime);
		expect(await page.evaluate(() => localStorage.getItem('chronolog.split-marker'))).toBeNull();
		expect(await savedEntries(page)).toHaveLength(0);
	});

	test('the known gap: a lost answer to discard-left + blank right, then Retry gets 404: the remainder is restored', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-gap');
		const data = await seed(page, 'SG');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		await openSplit(page);
		const boundary = await leftCard(page).getByTestId('split-left-to').inputValue();
		const requestIds: string[] = [];
		// First attempt: the server commits, the answer is lost
		await page.route('**/api/timer/split', async (route) => {
			requestIds.push(JSON.parse(route.request().postData() ?? '{}').clientRequestId);
			await route.fetch();
			await route.abort('failed');
		});
		await button(leftCard(page), 'Discard').click();
		await expect(leftCard(page).getByTestId('split-left-error')).toContainText("Couldn't reach the server");
		expect(await timerStatus(page)).toBeNull();
		await page.unroute('**/api/timer/split');
		await page.route('**/api/timer/split', async (route) => {
			requestIds.push(JSON.parse(route.request().postData() ?? '{}').clientRequestId);
			await route.continue();
		});
		await button(leftCard(page), 'Discard').click();
		await expect(leftCard(page).getByTestId('split-left-summary')).toContainText('Discarded');
		expect(requestIds).toHaveLength(2);
		expect(requestIds[1]).toBe(requestIds[0]);
		const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('chronolog.pending-timer') ?? 'null'));
		expect(pending?.startTime.slice(0, 5)).toBe(boundary);
		expect(pending?.endTime).toBeUndefined();
		await expect(button(rightCard(page), 'Resume')).toBeEnabled();
		await button(rightCard(page), 'Resume').click();
		await expect(overlay(page)).toHaveCount(0);
		await expect(widget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		expect(await savedEntries(page)).toHaveLength(0);
	});

	test('a changed request after an unanswered attempt gets a new id', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-new-id');
		const data = await seed(page, 'SN');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		await openSplit(page);
		const requestIds: string[] = [];
		await page.route('**/api/timer/split', async (route) => {
			requestIds.push(JSON.parse(route.request().postData() ?? '{}').clientRequestId);
			if (requestIds.length === 1) await route.abort('failed');
			else await route.continue();
		});
		await button(leftCard(page), 'Save').click();
		await expect(button(leftCard(page), 'Retry')).toBeEnabled();
		await leftCard(page).getByTestId('split-left-to').fill(await clockMinutesAgo(page, 20));
		await button(leftCard(page), 'Retry').click();
		await expect(leftCard(page).getByTestId('split-left-summary')).toBeVisible();
		expect(requestIds).toHaveLength(2);
		expect(requestIds[1]).not.toBe(requestIds[0]);
		expect(await savedEntries(page)).toHaveLength(1);
	});

	test('7: crossing into the phone layout cancels or keeps exactly what was committed', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-resize');
		const data = await seed(page, 'SZ');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		const original = await timerStatus(page);

		// a) Before resolution: as Cancel; growing again does not reopen
		await openSplit(page);
		await page.setViewportSize({ width: 600, height: 860 });
		await expect(overlay(page)).toHaveCount(0);
		await page.setViewportSize({ width: 1280, height: 860 });
		await expect(widget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await expect(overlay(page)).toHaveCount(0);
		expect((await timerStatus(page))?.startTime).toBe(original?.startTime);
		expect(await savedEntries(page)).toHaveLength(0);

		// b) After left Save: the left stays saved, the running remainder stays running with the right's fields
		await openSplit(page);
		const boundary = await leftCard(page).getByTestId('split-left-to').inputValue();
		await rightCard(page).locator('#split-right-contract').selectOption(data.contractId);
		await rightCard(page).locator('#split-right-description').fill('Second half');
		await button(leftCard(page), 'Save').click();
		await expect(leftCard(page).getByTestId('split-left-summary')).toBeVisible();
		await page.setViewportSize({ width: 600, height: 860 });
		await expect(overlay(page)).toHaveCount(0);
		await expect.poll(async () => (await timerStatus(page))?.description).toBe('Second half');
		const remainder = await timerStatus(page);
		expect(remainder?.startTime.slice(0, 5)).toBe(boundary);
		expect(remainder?.endTime).toBeNull();
		expect(await savedEntries(page)).toHaveLength(1);
		await page.setViewportSize({ width: 1280, height: 860 });
		await expect(widget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await expect(overlay(page)).toHaveCount(0);

		// c) After left Discard of a stopped capture: nothing logged; the blank right part (no
		//    contract) stays stopped as the browser's pending capture with the right's fields
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(widget(page).getByTestId('timer-completion-form')).toBeVisible();
		await openSplit(page);
		await button(leftCard(page), 'Discard').click();
		await expect(leftCard(page).getByTestId('split-left-summary')).toContainText('Discarded');
		await rightCard(page).locator('#split-right-description').fill('Third part');
		await page.setViewportSize({ width: 600, height: 860 });
		await expect(overlay(page)).toHaveCount(0);
		expect(await timerStatus(page)).toBeNull();
		const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('chronolog.pending-timer') ?? 'null'));
		expect(pending?.endTime).toBeTruthy();
		expect(await savedEntries(page)).toHaveLength(1);
		await page.setViewportSize({ width: 1280, height: 860 });
		await expect(widget(page).getByTestId('timer-completion-form')).toBeVisible();
		await expect(widget(page).locator('#timer-description')).toHaveValue('Third part');
		await expect(overlay(page)).toHaveCount(0);
		await button(widget(page), 'Discard').click();
		await expect(widget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();

		// d) During Save of a stopped capture: the answer settles once, then the saved branch applies
		await startTimer(page, data.contractId, 30, 'Fourth');
		await open(page, '/');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(widget(page).getByTestId('timer-completion-form')).toBeVisible();
		await openSplit(page);
		await page.getByRole('button', { name: 'Flip' }).click();
		await leftCard(page).locator('#split-left-contract').selectOption(data.otherContractId);
		let releaseSplit: () => void = () => undefined;
		const held = new Promise<void>((resolve) => (releaseSplit = resolve));
		await page.route('**/api/timer/split', async (route) => {
			await held;
			await route.continue();
		});
		await button(leftCard(page), 'Save').click();
		await expect(button(leftCard(page), 'Saving…')).toBeDisabled();
		await page.setViewportSize({ width: 600, height: 860 });
		await expect(overlay(page)).toHaveCount(0);
		releaseSplit();
		await expect.poll(async () => (await savedEntries(page)).length).toBe(2);
		await page.waitForTimeout(500);
		expect(await savedEntries(page)).toHaveLength(2);
		const last = await timerStatus(page);
		expect(last?.endTime).toBeTruthy();
		expect(last?.description).toBe('Fourth');
		await page.setViewportSize({ width: 1280, height: 860 });
		await expect(overlay(page)).toHaveCount(0);
		await expect(widget(page).getByTestId('timer-completion-form')).toBeVisible();
	});

	test('a reload during the split request settles it once from the marker', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'split-reload');
		const data = await seed(page, 'SL');
		await startTimer(page, data.contractId, 60, 'Planning');
		await open(page, '/');
		await openSplit(page);
		// The request never reaches the server; the marker was written first
		await page.route('**/api/timer/split', (route) => route.abort('failed'));
		await button(leftCard(page), 'Save').click();
		await expect(leftCard(page).getByTestId('split-left-error')).toContainText("Couldn't reach the server");
		expect(await page.evaluate(() => localStorage.getItem('chronolog.split-marker'))).toBeTruthy();
		await page.unroute('**/api/timer/split');
		await open(page, '/');
		await expect(widget(page).getByTestId('split-notice')).toBeVisible();
		expect(await savedEntries(page)).toHaveLength(1);
		expect(await page.evaluate(() => localStorage.getItem('chronolog.split-marker'))).toBeNull();
		// The remainder had no contract: it is the browser's pending timer from the boundary
		await expect(widget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		expect(await timerStatus(page)).toBeNull();
	});

	test('Split is disabled offline and for a timer with no contract yet', async ({ page, baseURL, context }) => {
		await signInAsFreshUser(page, baseURL, 'split-disabled');
		await open(page, '/');
		await widget(page).getByRole('button', { name: 'Start Timer' }).click();
		const splitButton = widget(page).getByTestId('timer-split-button');
		await expect(splitButton).toBeDisabled();
		await expect(splitButton).toHaveAttribute('title', 'Choose a contract to split this time');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(splitButton).toBeDisabled();

		const data = await seed(page, 'SD');
		await page.evaluate(() => localStorage.removeItem('chronolog.pending-timer'));
		await startTimer(page, data.contractId, 30);
		await open(page, '/');
		await expect(splitButton).toBeEnabled();
		await context.setOffline(true);
		await expect(splitButton).toBeDisabled();
		await expect(splitButton).toHaveAttribute('title', 'Split time is not available offline');
		await context.setOffline(false);
		await expect(splitButton).toBeEnabled();
	});
});

test.describe('phone @iphone', () => {
	test('no Split on the phone layout', async ({ page, baseURL }, testInfo) => {
		if (!testInfo.project.name.startsWith('iphone')) await page.setViewportSize({ width: 390, height: 844 });
		await signInAsFreshUser(page, baseURL, 'split-phone');
		const data = await seed(page, 'SP');
		await startTimer(page, data.contractId, 30);
		await open(page, '/');
		const phoneWidget = page.locator('[data-testid^="timer-widget-"]').first();
		await expect(phoneWidget.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await expect(page.getByTestId('timer-split-button')).toHaveCount(0);
		await phoneWidget.getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(phoneWidget.getByTestId('timer-completion-form')).toBeVisible();
		await expect(page.getByTestId('timer-split-button')).toHaveCount(0);
	});
});
