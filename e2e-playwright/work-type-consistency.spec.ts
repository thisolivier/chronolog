/**
 * Sprint 032-CL task 3: the UI never sends a work type that is not under the entry's deliverable.
 * - Card editor: changing the deliverable resets the work type picker to none, and the saved
 *   entry has no work type until one of the new deliverable's is picked.
 * - Add-entry row: the same, and the created entry has the new deliverable and no work type.
 * - A 400 from the API (should it ever come back) shows its message in the card's error line.
 */
import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'default' });

type Seeded = {
	contractLabel: string;
	discoveryId: string;
	recommendationsId: string;
	interviewsId: string;
	draftingId: string;
	entryId: string;
	today: string;
};

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

/** A client with one contract: Discovery (work type Interviews) and Recommendations (Drafting), and an entry today on Discovery > Interviews */
async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	const today = isoDate(new Date());
	await open(page, '/');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	return page.evaluate(
		async ({ suffix, today }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (!response.ok) throw new Error(`${url} ${response.status} ${await response.text()}`);
				return response.json();
			};
			const clientName = `Consistency ${suffix}`;
			const client = (await post('/api/clients', { name: clientName, shortCode: `K${suffix.slice(-4).toUpperCase()}` })).client;
			const contractName = `Research ${suffix}`;
			const contractId = (await post('/api/contracts', { clientId: client.id, name: contractName, isActive: true })).contract.id;
			const discovery = (await post('/api/deliverables', { contractId, name: 'Discovery' })).deliverable;
			const recommendations = (await post('/api/deliverables', { contractId, name: 'Recommendations', sortOrder: 1 })).deliverable;
			const interviews = (await post('/api/work-types', { deliverableId: discovery.id, name: 'Interviews' })).workType;
			const drafting = (await post('/api/work-types', { deliverableId: recommendations.id, name: 'Drafting' })).workType;
			const created = await post('/api/time-entries', {
				date: today,
				durationMinutes: 60,
				contractId,
				deliverableId: discovery.id,
				workTypeId: interviews.id,
				description: `Interviews ${suffix}`
			});
			return {
				contractLabel: `${clientName} / ${contractName}`,
				discoveryId: discovery.id,
				recommendationsId: recommendations.id,
				interviewsId: interviews.id,
				draftingId: drafting.id,
				entryId: created.entry.id,
				today
			};
		},
		{ suffix, today }
	);
}

async function readEntry(page: Page, date: string, entryId: string) {
	return page.evaluate(
		async ({ date, entryId }) => {
			const body = await (await fetch(`/api/time-entries?from=${date}&to=${date}`)).json();
			return body.entries.find((entry: { id: string }) => entry.id === entryId);
		},
		{ date, entryId }
	);
}

test.describe('Sprint 032 work type follows the deliverable', () => {
	test('card editor: changing the deliverable resets the work type to none, and the save matches', async ({ page }) => {
		const seeded = await seed(page);
		await open(page, '/time');
		const card = page.locator(`[data-entry-id="${seeded.entryId}"]`);
		await expect(card).toContainText('Discovery > Interviews');

		await card.getByTitle('Click to change deliverable / work type').click();
		const deliverablePicker = card.locator('select').nth(0);
		const workTypePicker = card.locator('select').nth(1);
		await expect(deliverablePicker).toHaveValue(seeded.discoveryId);
		await expect(workTypePicker).toHaveValue(seeded.interviewsId);

		await deliverablePicker.selectOption({ label: 'Recommendations' });
		await expect(workTypePicker).toHaveValue('');
		await expect(workTypePicker.locator('option')).toHaveText(['No work type', 'Drafting']);

		await expect.poll(async () => (await readEntry(page, seeded.today, seeded.entryId))?.deliverableId).toBe(seeded.recommendationsId);
		expect((await readEntry(page, seeded.today, seeded.entryId)).workTypeId).toBeNull();

		await workTypePicker.selectOption({ label: 'Drafting' });
		await expect.poll(async () => (await readEntry(page, seeded.today, seeded.entryId))?.workTypeId).toBe(seeded.draftingId);
		await expect(card.getByRole('alert')).toHaveCount(0);

		await card.getByRole('button', { name: 'Done' }).click();
		await expect(card).toContainText('Recommendations > Drafting');
	});

	test('add-entry row: changing the deliverable resets the work type before save', async ({ page }) => {
		const seeded = await seed(page);
		await open(page, '/time');
		await page.locator(`[data-add-entry="${seeded.today}"]`).click();
		const description = `Row entry ${Date.now().toString(36)}`;
		await page.keyboard.type(description);
		const prefix = `#new-entry-${seeded.today}`;
		await page.locator(`${prefix}-contract`).selectOption({ label: seeded.contractLabel });
		await page.locator(`${prefix}-deliverable`).selectOption({ label: 'Discovery' });
		await page.locator(`${prefix}-work-type`).selectOption({ label: 'Interviews' });

		await page.locator(`${prefix}-deliverable`).selectOption({ label: 'Recommendations' });
		await expect(page.locator(`${prefix}-work-type`)).toHaveValue('');

		await page.locator(`${prefix}-time`).fill('30m');
		await page.locator(`${prefix}-time`).press('Enter');
		const newCard = page.locator('[data-testid="time-entry-card"]', { hasText: description });
		await expect(newCard).toBeVisible();
		const newEntryId = (await newCard.getAttribute('data-entry-id'))!;
		const saved = await readEntry(page, seeded.today, newEntryId);
		expect(saved.deliverableId).toBe(seeded.recommendationsId);
		expect(saved.workTypeId).toBeNull();
	});

	test("card editor: an API mismatch message shows in the card's error line", async ({ page }) => {
		const seeded = await seed(page);
		await open(page, '/time');
		const message = 'Work type "Interviews" belongs to deliverable "Discovery", not "Recommendations"';
		await page.route(`**/api/time-entries/${seeded.entryId}`, (route) =>
			route.request().method() === 'PUT'
				? route.fulfill({
						status: 400,
						contentType: 'application/json',
						body: JSON.stringify({ error: message, code: 'work_type_mismatch', message })
					})
				: route.continue()
		);
		const card = page.locator(`[data-entry-id="${seeded.entryId}"]`);
		await card.getByTitle('Click to change deliverable / work type').click();
		await card.locator('select').nth(1).selectOption({ label: 'No work type' });
		await expect(card).toContainText(`Couldn't save: ${message}`);
	});
});
