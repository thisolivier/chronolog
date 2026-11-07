/**
 * Sprint 055-DR (design r1 stage 4): time capture and completion.
 * - Stop freezes the end: time spent filling the form never extends it (TC-04).
 * - The shared ontology cascade: sole options fill a chain with no helper badge and no layout
 *   shift; a contract switch clears what no longer applies and keeps description and links (TC-05).
 * - Stale captures: 409 timer_changed / not_a_draft are explained and the timer reloaded (TC-06).
 * - Manual entry: Escape and the backdrop never lose typed content (TC-09).
 * - Phone: the focused capture screen, Back keeps the unfinished entry, actions above the
 *   keyboard (TC-08; tagged @iphone so the iPhone projects run it).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-055');

type Seeded = {
	clientName: string;
	soleContractId: string;
	soleContractName: string;
	soleDeliverableId: string;
	soleWorkTypeId: string;
	branchContractId: string;
	discoveryId: string;
	workshopsId: string;
	noteId: string;
};

async function open(page: Page, target: string) {
	await page.goto(target);
	await page.waitForLoadState('networkidle');
}

/**
 * One client, two contracts: "Hungryroot" has one deliverable with one work type (the sole-option
 * chain); "Rank Group" has two deliverables, Discovery with two work types. A note under Hungryroot.
 */
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
			const clientName = `Amplitude ${label}`;
			const soleContractName = `Hungryroot ${suffix}`;
			const clientId = (await post('/api/clients', { name: clientName, shortCode: `C${suffix.slice(-5).toUpperCase()}` })).client.id;
			const soleContractId = (await post('/api/contracts', { clientId, name: soleContractName, isActive: true })).contract.id;
			const branchContractId = (await post('/api/contracts', { clientId, name: `Rank Group ${suffix}`, isActive: true })).contract.id;
			const soleDeliverableId = (await post('/api/deliverables', { contractId: soleContractId, name: 'Programme Management' })).deliverable.id;
			const soleWorkTypeId = (await post('/api/work-types', { deliverableId: soleDeliverableId, name: 'Ad Hoc Technical Support' })).workType.id;
			const discoveryId = (await post('/api/deliverables', { contractId: branchContractId, name: 'Discovery' })).deliverable.id;
			await post('/api/deliverables', { contractId: branchContractId, name: 'Implementation', sortOrder: 1 });
			await post('/api/work-types', { deliverableId: discoveryId, name: 'Interviews' });
			const workshopsId = (await post('/api/work-types', { deliverableId: discoveryId, name: 'Workshops' })).workType.id;
			const noteId = (await post('/api/notes', { contractId: soleContractId, title: `Roles ${suffix}`, content: `# Roles ${suffix}\n\nPermissions.` })).note.id;
			return { clientName, soleContractId, soleContractName, soleDeliverableId, soleWorkTypeId, branchContractId, discoveryId, workshopsId, noteId };
		},
		{ suffix, label }
	);
}

/** Start a server timer `minutesAgo` minutes ago on a contract (the browser's local clock) */
async function startTimer(page: Page, contractId: string, minutesAgo: number) {
	await page.evaluate(
		async ({ contractId, minutesAgo }) => {
			const start = new Date(Date.now() - minutesAgo * 60_000);
			const pad = (value: number) => String(value).padStart(2, '0');
			const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
			const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`;
			const response = await fetch('/api/timer/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, date, startTime, confirmed: true })
			});
			if (!response.ok) throw new Error(`start: ${response.status} ${await response.text()}`);
		},
		{ contractId, minutesAgo }
	);
}

type TimerStatus = { id: string; date: string; startTime: string; endTime: string | null; durationMinutes: number } | null;
async function timerStatus(page: Page): Promise<TimerStatus> {
	return page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer ?? null);
}

async function entry(page: Page, entryId: string) {
	return page.evaluate(async (entryId) => (await (await fetch(`/api/time-entries/${entryId}`)).json()).entry, entryId);
}

const widget = (page: Page) => page.getByTestId('timer-widget-sidebar');
const saveButton = (scope: Locator) => scope.getByRole('button', { name: 'Save', exact: true });

/** Delay the deliverable and work type lists, so the form is seen before and after they arrive */
async function slowOntology(page: Page, delayMs: number) {
	await page.route(/\/api\/(deliverables|work-types)\?/, async (route) => {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
		await route.continue();
	});
}

test.describe('desktop 1280', () => {
	test.use({ viewport: { width: 1280, height: 860 } });

	test('stop, wait two minutes, save: the saved end is the stop instant', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'capture-freeze');
		const data = await seed(page, 'CF');
		await page.clock.install();
		await startTimer(page, data.soleContractId, 25);
		await open(page, '/');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(widget(page).getByTestId('timer-completion-form')).toBeVisible();
		const stopped = await timerStatus(page);
		expect(stopped?.endTime).toBeTruthy();

		// Two minutes describing and classifying
		await page.clock.fastForward('02:00');
		await widget(page).locator('#timer-description').fill('Roles and permissions');
		await expect(widget(page).locator('#timer-work-type')).toHaveValue(data.soleWorkTypeId);
		await saveButton(widget(page)).click();
		await expect(widget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();

		const saved = await entry(page, stopped!.id);
		expect(saved.isDraft).toBe(false);
		expect(saved.endTime).toBe(stopped!.endTime);
		expect(saved.durationMinutes).toBe(stopped!.durationMinutes);
	});

	test('a sole-option chain fills itself with no helper and the form never shifts', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'capture-sole');
		const data = await seed(page, 'CS');
		await startTimer(page, data.soleContractId, 24);
		await slowOntology(page, 1500);
		await open(page, '/');
		const form = widget(page).getByTestId('timer-completion-form');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(form).toBeVisible();

		// From the moment of Stop: every control in place, the dependent ones still loading
		await expect(widget(page).getByTestId('cascade-deliverable')).toHaveAttribute('data-cascade-state', 'loading');
		await expect(widget(page).getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', /waiting|loading/);
		for (const field of ['#timer-description', '#timer-contract', '#timer-deliverable', '#timer-work-type', '#timer-time']) {
			await expect(widget(page).locator(field)).toBeVisible();
		}
		const saveBefore = await saveButton(widget(page)).boundingBox();
		const timeBefore = await widget(page).locator('#timer-time').boundingBox();

		// The chain: Hungryroot → its one deliverable → its one work type
		await expect(widget(page).locator('#timer-deliverable')).toHaveValue(data.soleDeliverableId);
		await expect(widget(page).locator('#timer-work-type')).toHaveValue(data.soleWorkTypeId);
		await expect(widget(page).getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', 'ready');
		await expect(form).not.toContainText(/only option/i);
		expect(await saveButton(widget(page)).boundingBox()).toEqual(saveBefore);
		expect(await widget(page).locator('#timer-time').boundingBox()).toEqual(timeBefore);
		await widget(page).locator('#timer-description').fill('Roles and permissions');
		await page.screenshot({ path: path.join(SCREENSHOTS, '03-desktop-ready-to-save.png') });
	});

	test('switching contract clears what no longer applies and keeps the description and its links', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'capture-switch');
		const data = await seed(page, 'CW');
		await startTimer(page, data.branchContractId, 24);
		await open(page, '/');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		const description = `Roles and permissions [[${data.noteId}]]`;
		await widget(page).locator('#timer-description').fill(description);

		// Several deliverables: nothing chosen for the user; the work type waits for one
		await expect(widget(page).getByTestId('cascade-deliverable')).toHaveAttribute('data-cascade-state', 'ready');
		await expect(widget(page).locator('#timer-deliverable')).toHaveValue('');
		await expect(widget(page).locator('#timer-work-type')).toBeDisabled();
		await expect(widget(page).locator('#timer-work-type')).toContainText('Choose a deliverable first');
		await page.screenshot({ path: path.join(SCREENSHOTS, '01-desktop-just-stopped.png') });
		await widget(page).locator('#timer-deliverable').selectOption(data.discoveryId);
		await expect(widget(page).getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', 'ready');
		await widget(page).locator('#timer-work-type').selectOption(data.workshopsId);
		await page.screenshot({ path: path.join(SCREENSHOTS, '02-desktop-options-chosen.png') });

		// To the sole-option contract: its chain replaces the incompatible choices
		await widget(page).locator('#timer-contract').selectOption(data.soleContractId);
		await expect(widget(page).locator('#timer-deliverable')).toHaveValue(data.soleDeliverableId);
		await expect(widget(page).locator('#timer-work-type')).toHaveValue(data.soleWorkTypeId);
		await expect(widget(page).locator('#timer-description')).toHaveValue(description);
		// And back: Discovery is valid again but is one of several, so it is not guessed
		await widget(page).locator('#timer-contract').selectOption(data.branchContractId);
		await expect(widget(page).locator('#timer-deliverable')).toHaveValue('');
		await expect(widget(page).getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', 'waiting');
		await widget(page).locator('#timer-contract').selectOption(data.soleContractId);
		await expect(widget(page).locator('#timer-work-type')).toHaveValue(data.soleWorkTypeId);

		const draftId = (await timerStatus(page))!.id;
		await saveButton(widget(page)).click();
		await expect(widget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();
		const saved = await entry(page, draftId);
		expect(saved.contractId).toBe(data.soleContractId);
		expect(saved.deliverableId).toBe(data.soleDeliverableId);
		expect(saved.workTypeId).toBe(data.soleWorkTypeId);
		expect(saved.description).toBe(description);
	});

	test('a failed list keeps the chosen value and offers Retry', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'capture-fail');
		const data = await seed(page, 'CX');
		await startTimer(page, data.soleContractId, 10);
		let failWorkTypes = true;
		await page.route(/\/api\/work-types\?/, (route) => (failWorkTypes ? route.fulfill({ status: 500, body: '{"error":"boom"}' }) : route.continue()));
		await open(page, '/');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(widget(page).getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', 'failed');
		await expect(widget(page).locator('#timer-work-type')).toContainText("Couldn't load work types");
		failWorkTypes = false;
		await widget(page).getByTestId('cascade-workType-retry').click();
		await expect(widget(page).locator('#timer-work-type')).toHaveValue(data.soleWorkTypeId);
	});

	test('a save refused as stale (409) explains, reloads and never overwrites', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'capture-409');
		const data = await seed(page, 'CC');
		await startTimer(page, data.soleContractId, 30);
		await open(page, '/');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await widget(page).locator('#timer-description').fill('Kept through the conflict');
		const stopped = (await timerStatus(page))!;

		// Another device moves the stopped draft's start ten minutes later
		const movedStart = await page.evaluate(async (stopped) => {
			const [hours, minutes] = stopped.startTime.split(':').map(Number);
			const moved = new Date(2000, 0, 1, hours, minutes + 10);
			const startTime = `${String(moved.getHours()).padStart(2, '0')}:${String(moved.getMinutes()).padStart(2, '0')}`;
			const response = await fetch('/api/timer', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startTime, date: stopped.date, confirmed: true })
			});
			if (!response.ok) throw new Error(`move: ${response.status} ${await response.text()}`);
			return startTime;
		}, stopped);

		await saveButton(widget(page)).click();
		await expect(widget(page).getByTestId('timer-error')).toContainText('changed on another device');
		// Reloaded: the server's new interval, the typed description kept, still a draft
		await expect(widget(page).locator('#timer-time')).toHaveValue(new RegExp(`^${movedStart}-`));
		await expect(widget(page).locator('#timer-description')).toHaveValue('Kept through the conflict');
		expect((await entry(page, stopped.id)).isDraft).toBe(true);
		await saveButton(widget(page)).click();
		await expect(widget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();
		expect((await entry(page, stopped.id)).isDraft).toBe(false);

		// not_a_draft: saved elsewhere first; this device's Save is refused and the timer resets
		await startTimer(page, data.soleContractId, 15);
		await open(page, '/');
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await widget(page).locator('#timer-description').fill('From the stale device');
		const second = (await timerStatus(page))!;
		await page.evaluate(async ({ entryId, contractId }) => {
			await fetch('/api/timer/save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entryId, contractId, description: 'Saved on the phone' })
			});
		}, { entryId: second.id, contractId: data.soleContractId });
		await saveButton(widget(page)).click();
		await expect(widget(page).getByTestId('timer-error')).toContainText('already saved or discarded');
		await expect(widget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();
		expect((await entry(page, second.id)).description).toBe('Saved on the phone');
	});

	test('Add Time Entry: Escape and the backdrop never drop typed content', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'capture-modal');
		const data = await seed(page, 'CM');
		await open(page, '/');
		const dialog = page.getByRole('dialog', { name: 'Add Time Entry' });

		// A clean form closes on Escape
		await widget(page).getByRole('button', { name: 'Add Entry' }).click();
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);

		await widget(page).getByRole('button', { name: 'Add Entry' }).click();
		await dialog.locator('#entry-description').fill('Workshop prep');
		await dialog.locator('#entry-contract').selectOption(data.soleContractId);
		await expect(dialog.locator('#work-type-select')).toHaveValue(data.soleWorkTypeId);
		// Escape with a select focused belongs to the select
		await dialog.locator('#entry-contract').focus();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeVisible();
		await expect(page.getByTestId('add-entry-confirm-close')).toHaveCount(0);
		// Dirty: Escape asks, Keep editing keeps everything
		await dialog.locator('#entry-description').focus();
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('add-entry-confirm-close')).toBeVisible();
		await dialog.getByRole('button', { name: 'Keep editing' }).click();
		await expect(dialog.locator('#entry-description')).toHaveValue('Workshop prep');
		// The backdrop asks too
		await page.getByTestId('add-entry-backdrop').click({ position: { x: 10, y: 10 } });
		await expect(page.getByTestId('add-entry-confirm-close')).toBeVisible();
		await dialog.getByRole('button', { name: 'Keep editing' }).click();
		await dialog.locator('#entry-duration').fill('9:00-9:45');
		await page.screenshot({ path: path.join(SCREENSHOTS, '04-desktop-manual-entry.png') });
		await saveButton(dialog).click();
		await expect(dialog).toHaveCount(0);
	});
});

test.describe('phone @iphone', () => {
	test('capture screen: Add note and Stop; Back keeps the stopped entry; actions stay above the keyboard', async ({ page, baseURL }, testInfo) => {
		const isIphoneProject = testInfo.project.name.startsWith('iphone');
		if (!isIphoneProject) await page.setViewportSize({ width: 390, height: 844 });
		await signInAsFreshUser(page, baseURL, 'capture-phone');
		const data = await seed(page, 'PH');
		await startTimer(page, data.soleContractId, 24);
		await open(page, `/notes/${data.soleContractId}/${data.noteId}`);
		const pill = page.getByTestId('timer-indicator');
		const surface = page.getByTestId('phone-capture-screen');
		const screenWidget = page.getByTestId('timer-widget-screen');

		await pill.click();
		await expect(surface).toBeVisible();
		await expect(screenWidget.getByTestId('capture-add-note')).toBeVisible();
		await expect(screenWidget.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await expect(screenWidget.getByTestId('timer-collapse-toggle')).toHaveCount(0);
		await expect(screenWidget.getByTestId('timer-split-button')).toHaveCount(0);
		await expect(pill).toHaveCount(0);
		await page.screenshot({ path: path.join(SCREENSHOTS, `05-phone-running-${testInfo.project.name}.png`) });

		await screenWidget.getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(screenWidget.locator('#timer-work-type')).toHaveValue(data.soleWorkTypeId);
		await screenWidget.locator('#timer-description').fill('Follow-up on roles');
		const frozenRange = await screenWidget.getByTestId('timer-frozen-range').innerText();
		const timeText = await screenWidget.locator('#timer-time').inputValue();
		await page.screenshot({ path: path.join(SCREENSHOTS, `06-phone-stopped-${testInfo.project.name}.png`) });

		// Back: the note is still there; the pill reads Finish entry; nothing was saved or resumed
		await page.getByTestId('capture-screen-back').click();
		await expect(surface).toHaveCount(0);
		await expect(page).toHaveURL(new RegExp(`/notes/${data.soleContractId}/${data.noteId}`));
		await expect(pill).toHaveAttribute('data-state', 'finish');
		expect((await timerStatus(page))?.endTime).toBeTruthy();
		// Elsewhere and back again, then reopen: the fields and the frozen time survive
		await page.getByTestId('mobile-back').click();
		await expect(page.getByTestId('timer-widget-sidebar').locator('#timer-description')).toHaveValue('Follow-up on roles');
		await page.goForward();
		await expect(page).toHaveURL(new RegExp(`/notes/${data.soleContractId}/${data.noteId}`));
		await pill.click();
		await expect(screenWidget.locator('#timer-description')).toHaveValue('Follow-up on roles');
		await expect(screenWidget.getByTestId('timer-frozen-range')).toHaveText(frozenRange);
		await expect(screenWidget.locator('#timer-time')).toHaveValue(timeText);

		// A software keyboard: the visible viewport shrinks. The pinned actions stay on screen and
		// the focused field is not under them.
		const size = page.viewportSize()!;
		await page.setViewportSize({ width: size.width, height: 360 });
		await screenWidget.locator('#timer-time').focus();
		await page.waitForTimeout(400);
		const actions = await screenWidget.getByTestId('timer-completion-actions').boundingBox();
		const focused = await screenWidget.locator('#timer-time').boundingBox();
		expect(actions!.y + actions!.height).toBeLessThanOrEqual(360 + 1);
		expect(focused!.y + focused!.height).toBeLessThanOrEqual(actions!.y + 1);
		await expect(saveButton(screenWidget)).toBeInViewport();
		await page.setViewportSize(size);

		await saveButton(screenWidget).click();
		await expect(surface).toHaveCount(0);
		await expect(pill).toHaveCount(0);
	});

	test('manual entry fits a short viewport with Cancel and Save reachable', async ({ page, baseURL }, testInfo) => {
		const isIphoneProject = testInfo.project.name.startsWith('iphone');
		if (!isIphoneProject) await page.setViewportSize({ width: 390, height: 844 });
		await signInAsFreshUser(page, baseURL, 'capture-phone-manual');
		const data = await seed(page, 'PM');
		await open(page, '/');
		await page.locator('[data-testid^="timer-widget-"]').first().getByRole('button', { name: 'Add Entry' }).click();
		const dialog = page.getByRole('dialog', { name: 'Add Time Entry' });
		await dialog.locator('#entry-description').fill('Follow-up on roles and permissions');
		await dialog.locator('#entry-contract').selectOption(data.soleContractId);
		const size = page.viewportSize()!;
		await page.setViewportSize({ width: size.width, height: 400 });
		await dialog.locator('#entry-description').focus();
		await page.waitForTimeout(400);
		await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
		await expect(saveButton(dialog)).toBeInViewport();
		const actions = await page.getByTestId('add-entry-actions').boundingBox();
		const focused = await dialog.locator('#entry-description').boundingBox();
		expect(focused!.y + focused!.height).toBeLessThanOrEqual(actions!.y + 1);
		await page.screenshot({ path: path.join(SCREENSHOTS, `07-phone-manual-entry-${testInfo.project.name}.png`) });
		await page.setViewportSize(size);
	});
});
