/**
 * Checkpoint B/C (design r1, stages 4–7 merged): the TC / TR / SR acceptance rows and supporting
 * states that no single stage spec covers, because they need the stages together — mostly the
 * three cross-stage follow-ups closed at this checkpoint.
 * - TC-05 / IN-03 in the timesheet (stage 4's cascade in stage 6's rows): opening never picks; a
 *   deliverable pick takes the sole work type; after a contract change the pickers start at none
 *   and a level with no options reads "Not applicable"; a failed list offers Retry.
 * - SR-04 / SR-06 / SR-07 in the time-entry description (stage 7's picker in stage 6's form):
 *   recent notes on a bare [[ with identity rows, Escape keeps the text, Enter while the query
 *   loads inserts from its own reply.
 * - TC-08 short desktop height, absent contract, no applicable ontology: the completion form on
 *   /time at 1280×600 keeps Save reachable and saves into the week.
 * - TC-08 phone: a timer started from the home widget is the week's header pill, which opens the capture screen (060-DR: no Start timer in the phone week).
 * Every other row of the spec 08 matrix is covered by a stage spec; see
 * docs/review/2026-11-07-checkpoint-bc.md for the table.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInAsFreshUser } from './fresh-user';
import { seedCheckpointBc } from './checkpoint-bc-seed';

const NONE = 'none';
const row = (page: Page, entryId: string) => page.locator(`[data-entry-id="${entryId}"]`);

async function readEntry(page: Page, date: string, entryId: string) {
	return page.evaluate(
		async ({ date, entryId }) => {
			const body = await (await fetch(`/api/time-entries?from=${date}&to=${date}`)).json();
			return body.entries.find((entry: { id: string }) => entry.id === entryId);
		},
		{ date, entryId }
	);
}

async function openTime(page: Page) {
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('time-entry-card').first()).toBeVisible();
}

test.describe('desktop', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('timesheet inline classification follows the shared cascade', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'bc-inline-cascade');
		const data = await seedCheckpointBc(page);
		await openTime(page);

		// Opening on an entry with no deliverable picks nothing by itself
		const cueRow = row(page, data.cueEntryId);
		await cueRow.getByTestId('missing-detail-cue').click();
		const deliverable = cueRow.getByTestId('cascade-deliverable').locator('select');
		const workType = cueRow.getByTestId('cascade-workType').locator('select');
		await expect(cueRow.getByTestId('cascade-deliverable')).toHaveAttribute('data-cascade-state', 'ready');
		await expect(deliverable).toHaveValue(NONE);
		await expect(workType).toBeDisabled();
		expect((await readEntry(page, data.today, data.cueEntryId)).deliverableId).toBeNull();

		// A deliverable with one work type takes it; the pair is saved together
		await deliverable.selectOption({ label: 'Dashboard' });
		await expect(workType).toHaveValue(data.buildId);
		await expect.poll(async () => (await readEntry(page, data.today, data.cueEntryId)).workTypeId).toBe(data.buildId);
		expect((await readEntry(page, data.today, data.cueEntryId)).deliverableId).toBe(data.dashboardId);
		await cueRow.getByRole('button', { name: 'Done' }).click();
		await expect(cueRow).toContainText('Dashboard > Build');

		// Contract change: the chain is cleared, the pickers open at none on the new contract;
		// Summer schedule has no work types, so the level below reads "Not applicable"
		const pipelineRow = row(page, data.pipelineEntryId);
		await pipelineRow.getByTitle('Click to change contract').click();
		await pipelineRow.locator('select').first().selectOption({ label: 'EasyJet / Crew Rostering' });
		await expect(pipelineRow.getByTestId('contract-change-notice')).toContainText('Event pipeline > Analysis');
		const newDeliverable = pipelineRow.getByTestId('cascade-deliverable').locator('select');
		await expect(newDeliverable).toHaveValue(NONE);
		await newDeliverable.selectOption({ label: 'Summer schedule' });
		await expect(pipelineRow.getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', 'not-applicable');
		await expect(pipelineRow.getByTestId('cascade-workType').locator('select')).toContainText('Not applicable');
		await expect.poll(async () => (await readEntry(page, data.today, data.pipelineEntryId)).deliverableId).toBe(data.summerScheduleId);
		await pipelineRow.getByRole('button', { name: 'Done' }).click();

		// A failed list keeps the held value and offers Retry
		let failDeliverables = true;
		await page.route(/\/api\/deliverables\?/, (route) => (failDeliverables ? route.fulfill({ status: 500, body: '{"error":"boom"}' }) : route.continue()));
		await cueRow.getByTitle('Click to change deliverable / work type').click();
		await expect(cueRow.getByTestId('cascade-deliverable')).toHaveAttribute('data-cascade-state', 'failed');
		await expect(cueRow.getByTestId('cascade-deliverable').locator('select')).toContainText("Couldn't load deliverables: your choice is kept");
		failDeliverables = false;
		await cueRow.getByTestId('cascade-deliverable-retry').click();
		await expect(deliverable).toHaveValue(data.dashboardId);
		await expect(workType).toHaveValue(data.buildId);
	});

	test('time-entry description: the shared [[ picker with recent notes, identity, Escape and early Enter', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'bc-entry-picker');
		const data = await seedCheckpointBc(page);
		const crewNoteId = await page.evaluate(async () => (await (await fetch('/api/notes/search?q=Crew%20rostering')).json()).notes[0].id as string);
		await openTime(page);
		await page.locator(`[data-add-entry="${data.today}"]`).click();
		const description = page.getByPlaceholder('What did you work on?');
		await expect(description).toBeFocused();

		// A bare [[ lists recent notes of every contract, with the mark and client / contract
		await page.keyboard.type('Answered [[');
		const picker = page.getByTestId('link-picker');
		await expect(picker).toHaveAttribute('data-status', 'ready');
		await expect(page.getByRole('listbox', { name: 'Link a note' })).toBeVisible();
		await expect.poll(() => picker.getByTestId('link-picker-option').count()).toBeGreaterThanOrEqual(5);
		await expect(picker.getByTestId('link-picker-option').filter({ hasText: 'Pricing review' })).toContainText('Amplitude / Rank Group');

		// Typing narrows it; Enter inserts the ID and closes the list
		await page.keyboard.type('Payroll');
		await expect(picker.getByTestId('link-picker-option')).toHaveCount(1);
		await expect(picker.getByTestId('link-picker-title')).toHaveText('Payroll integration questions');
		await page.keyboard.press('Enter');
		await expect(description).toHaveValue(`Answered [[${data.dailyPayNoteId}]]`);
		await expect(picker).toHaveCount(0);

		// Escape closes the list and keeps the typed text; the form stays open
		await page.keyboard.type(' and [[Kick');
		await expect(picker).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(picker).toHaveCount(0);
		await expect(description).toHaveValue(`Answered [[${data.dailyPayNoteId}]] and [[Kick`);
		await expect(description).toBeVisible();

		// Enter while the newer query loads inserts from its reply, never the older rows
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Backspace');
		await page.route('**/api/notes/search?*', async (route) => {
			if (new URL(route.request().url()).searchParams.get('q') === 'Crew') await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue().catch(() => {});
		});
		await page.keyboard.type('[[');
		await expect(picker).toHaveAttribute('data-status', 'ready');
		await page.keyboard.type('Crew');
		await page.keyboard.press('Enter');
		await expect(description).toHaveValue(`Answered [[${data.dailyPayNoteId}]] and [[Crew`);
		await expect(description).toHaveValue(`Answered [[${data.dailyPayNoteId}]] and [[${crewNoteId}]]`, { timeout: 5000 });

		// The entry saves with both links, rendered as links in its row
		await page.locator(`#new-entry-${data.today}-contract`).selectOption({ label: 'EasyJet / Crew Rostering' });
		await page.locator(`#new-entry-${data.today}-time`).fill('20m');
		await page.locator(`#new-entry-${data.today}-time`).press('Enter');
		const saved = page.getByTestId('time-entry-card').filter({ hasText: 'Answered' });
		await expect(saved).toContainText('Payroll integration questions');
		await expect(saved).toContainText('Crew rostering workshop');
	});

	test('short desktop height: a contractless stop on /time completes into the week; no ontology reads Not applicable', async ({ page, baseURL }) => {
		await page.setViewportSize({ width: 1280, height: 600 });
		await signInAsFreshUser(page, baseURL, 'bc-short-height');
		const data = await seedCheckpointBc(page);
		await openTime(page);
		// On /time no contract is open, so Start Timer starts a timer with no contract yet
		const widget = page.getByTestId('timer-widget-sidebar');
		await widget.getByRole('button', { name: 'Start Timer' }).click();
		await widget.getByRole('button', { name: 'Stop', exact: true }).click();

		// Absent contract: every level is drawn, nothing chosen, nothing jumps
		await expect(widget.getByTestId('cascade-contract')).toHaveAttribute('data-cascade-state', 'ready');
		await expect(widget.getByTestId('cascade-deliverable')).toHaveAttribute('data-cascade-state', 'waiting');
		const save = widget.getByRole('button', { name: 'Save', exact: true });
		await save.scrollIntoViewIfNeeded();
		await expect(save).toBeInViewport();
		await save.click();
		await expect(widget.getByRole('alert').first()).toContainText('Pick a contract');

		// A contract with no deliverables: "Not applicable" below it, and Save completes
		await widget.getByTestId('cascade-contract').locator('select').selectOption({ label: 'Amplitude / Daily Pay' });
		await expect(widget.getByTestId('cascade-deliverable')).toHaveAttribute('data-cascade-state', 'not-applicable');
		await expect(widget.getByTestId('cascade-workType')).toHaveAttribute('data-cascade-state', 'waiting');
		await widget.locator('textarea, input[type="text"]').first().fill('Webhook retry follow-up');
		await save.scrollIntoViewIfNeeded();
		await expect(save).toBeInViewport();
		await save.click();
		await expect(widget.getByRole('button', { name: 'Start Timer' })).toBeVisible();
		const todaySection = page.locator(`[data-day="${data.today}"]`);
		await expect(todaySection.getByTestId('time-entry-card').filter({ hasText: 'Webhook retry follow-up' })).toContainText('Daily Pay');
	});
});

test.describe('phone @iphone', () => {
	test('a timer started on the home screen is the pill on the week, which opens the capture screen @iphone', async ({ page, baseURL }, testInfo) => {
		test.skip(!testInfo.project.name.startsWith('iphone'), 'phone layout');
		await signInAsFreshUser(page, baseURL, 'bc-phone-start');
		await seedCheckpointBc(page);
		await openTime(page);
		const screen = page.getByTestId('phone-capture-screen');

		// Owner change (060-DR): the phone week has no Start timer; the home screen's widget starts it
		await expect(page.getByTestId('phone-start-timer')).toHaveCount(0);
		await expect(page.getByTestId('timer-indicator')).toHaveCount(0);
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByTestId('timer-widget-sidebar').getByRole('button', { name: 'Start Timer' }).click();
		await expect(page.getByTestId('timer-widget-sidebar').getByRole('button', { name: 'Stop', exact: true })).toBeVisible();

		// Running: the week shows the pill, and the pill opens the capture screen
		await openTime(page);
		await page.getByTestId('timer-indicator').click();
		await expect(screen).toBeVisible();
		await expect(screen.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Stop', exact: true }).click();
		await screen.getByRole('button', { name: /Discard/ }).click();
		await expect(screen).toHaveCount(0);
		await expect(page.getByTestId('timer-indicator')).toHaveCount(0);
	});
});
