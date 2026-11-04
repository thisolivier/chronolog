/**
 * Sprint 030-CL: timesheet polish, asserted in the real UI.
 * - Task 4 (P-05): changing an entry's contract clears its deliverable and work type visibly
 *   (pickers at none, a one-line notice) and the saved entry matches what the card shows.
 * - Task 6 (A-11): after saving an entry focus is on its card, not <body>; after following a
 *   card's wiki-link focus is in the opened note's editor.
 */
import { test, expect, type Page } from '@playwright/test';

// One worker per file: the seeds share one user and its client short codes
test.describe.configure({ mode: 'default' });

type Seeded = {
	sourceContract: string;
	targetContract: string;
	sourceLabel: string;
	targetLabel: string;
	entryId: string;
	entryDescription: string;
	noteId: string;
	noteTitle: string;
	linkDescription: string;
	today: string;
};

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

/** A client with two contracts, each with a deliverable (the source's has a work type), a note, and two entries today */
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
				if (!response.ok) throw new Error(`${url} ${response.status}`);
				return response.json();
			};
			const action = async (url: string, fields: Record<string, string>) => {
				const form = new FormData();
				for (const [key, value] of Object.entries(fields)) form.append(key, value);
				const response = await fetch(url, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
				const result = await response.json();
				if (result.type !== 'success') throw new Error(`${url} ${JSON.stringify(result)}`);
			};
			const shortCode = `P${suffix.slice(-4).toUpperCase()}`;
			const clientName = `Polish ${suffix}`;
			await action('/admin/clients?/create', { name: clientName, short_code: shortCode, color_index: '2' });
			const clientsBody = await (await fetch('/api/clients')).json();
			const clientList: { id: string; shortCode: string }[] = clientsBody.clients ?? clientsBody;
			const client = clientList.find((candidate) => candidate.shortCode === shortCode)!;
			const sourceName = `Source ${suffix}`;
			const targetName = `Target ${suffix}`;
			const sourceContract = (await post('/api/contracts', { clientId: client.id, name: sourceName, isActive: true })).contract.id;
			const targetContract = (await post('/api/contracts', { clientId: client.id, name: targetName, isActive: true })).contract.id;
			const contractPage = (contractId: string) => `/admin/clients/${client.id}/contracts/${contractId}`;
			await action(`${contractPage(sourceContract)}?/createDeliverable`, { name: 'Phase Two', sort_order: '0' });
			await action(`${contractPage(targetContract)}?/createDeliverable`, { name: 'Target Phase', sort_order: '0' });
			const sourceDeliverable = (await (await fetch(`/api/deliverables?contractId=${sourceContract}`)).json())[0];
			await action(`${contractPage(sourceContract)}?/createWorkType`, {
				deliverable_id: sourceDeliverable.id,
				name: 'Build',
				sort_order: '0'
			});
			const workType = (await (await fetch(`/api/work-types?deliverableId=${sourceDeliverable.id}`)).json())[0];
			const entryDescription = `Pipeline ${suffix}`;
			const created = await post('/api/time-entries', {
				date: today,
				durationMinutes: 90,
				contractId: sourceContract,
				deliverableId: sourceDeliverable.id,
				workTypeId: workType.id,
				description: entryDescription
			});
			const noteTitle = `Linked note ${suffix}`;
			const noteId = (await post('/api/notes', { contractId: sourceContract, title: noteTitle, content: `${noteTitle}\n\nBody` })).note.id;
			const linkDescription = `Linked card ${suffix}`;
			await post('/api/time-entries', {
				date: today,
				durationMinutes: 15,
				contractId: sourceContract,
				description: `${linkDescription} [[${noteId}]]`
			});
			return {
				sourceContract,
				targetContract,
				sourceLabel: `${clientName} / ${sourceName}`,
				targetLabel: `${clientName} / ${targetName}`,
				entryId: (created.entry ?? created).id,
				entryDescription,
				noteId,
				noteTitle,
				linkDescription,
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

/** What has focus, described well enough to assert on */
async function activeElementInfo(page: Page) {
	return page.evaluate(() => {
		const active = document.activeElement as HTMLElement | null;
		return {
			tag: active?.tagName ?? null,
			isBody: active === document.body,
			entryId: active?.getAttribute('data-entry-id') ?? null,
			inNoteEditor: Boolean(active?.closest('[data-note-editor-content]')),
			isContentEditable: Boolean(active?.isContentEditable)
		};
	});
}

test.describe('Sprint 030 timesheet polish', () => {
	test('task 4: changing the contract clears deliverable and work type visibly, and the save matches', async ({ page }) => {
		const seeded = await seed(page);
		await open(page, '/time');
		const card = page.locator(`[data-entry-id="${seeded.entryId}"]`);
		await expect(card).toContainText('Phase Two > Build');

		await card.getByTitle('Click to change contract').click();
		await card.locator('select').first().selectOption({ label: seeded.targetLabel });

		// The pickers are open on the new contract and set to none, with a one-line notice
		const notice = card.getByTestId('contract-change-notice');
		await expect(notice).toBeVisible();
		await expect(notice).toHaveText(`Cleared “Phase Two > Build”: it belongs to ${seeded.sourceLabel}.`);
		const deliverablePicker = card.locator('select').first();
		await expect(deliverablePicker).toHaveValue('');
		await expect(deliverablePicker.locator('option')).toContainText(['No deliverable', 'Target Phase']);
		await expect(card).toContainText(seeded.targetLabel);
		// The old "Phase Two > Build" label is gone (it is named only in the notice)
		await expect(card.getByTitle('Click to change deliverable / work type')).toHaveCount(0);

		// The saved entry is what the card shows
		await expect.poll(async () => (await readEntry(page, seeded.today, seeded.entryId))?.contractId).toBe(seeded.targetContract);
		const saved = await readEntry(page, seeded.today, seeded.entryId);
		expect(saved.deliverableId).toBeNull();
		expect(saved.workTypeId).toBeNull();

		// Done closes the pickers and the notice; a reload shows the same thing
		await card.getByRole('button', { name: 'Done' }).click();
		await expect(notice).toHaveCount(0);
		await page.reload();
		await page.waitForLoadState('networkidle');
		const reloadedCard = page.locator(`[data-entry-id="${seeded.entryId}"]`);
		await expect(reloadedCard).toContainText(seeded.targetLabel);
		await expect(reloadedCard).not.toContainText('Phase Two');
	});

	test('task 6: after saving a new entry, focus is on its card', async ({ page }) => {
		const seeded = await seed(page);
		await open(page, '/time');
		await page.locator(`[data-add-entry="${seeded.today}"]`).click();
		const description = `Keyboard entry ${Date.now().toString(36)}`;
		await page.keyboard.type(description);
		await page.locator(`#new-entry-${seeded.today}-contract`).selectOption({ label: seeded.targetLabel });
		await page.locator(`#new-entry-${seeded.today}-time`).fill('45m');
		await page.locator(`#new-entry-${seeded.today}-time`).press('Enter');

		const newCard = page.locator('[data-testid="time-entry-card"]', { hasText: description });
		await expect(newCard).toBeVisible();
		const newEntryId = await newCard.getAttribute('data-entry-id');
		await expect.poll(async () => (await activeElementInfo(page)).entryId).toBe(newEntryId);
		expect((await activeElementInfo(page)).isBody).toBe(false);
	});

	test('task 6: Escape in the new-entry row returns focus to its "+"', async ({ page }) => {
		const seeded = await seed(page);
		await open(page, '/time');
		const addButton = page.locator(`[data-add-entry="${seeded.today}"]`);
		await addButton.click();
		await page.keyboard.press('Escape');
		await expect(addButton).toBeFocused();
	});

	test("task 6: following a card's wiki-link puts focus in the note's editor", async ({ page }) => {
		const seeded = await seed(page);
		await open(page, '/time');
		const card = page.locator('[data-testid="time-entry-card"]', { hasText: seeded.linkDescription });
		const link = card.locator(`button[title="${seeded.noteId}"]`);
		await link.focus();
		await page.keyboard.press('Enter');

		await page.waitForURL((url) => url.pathname.endsWith(`/${seeded.noteId}`));
		await expect(page.locator('[data-note-editor-content]')).toContainText(seeded.noteTitle);
		await expect.poll(async () => (await activeElementInfo(page)).inNoteEditor).toBe(true);
		const focused = await activeElementInfo(page);
		expect(focused.isBody).toBe(false);
		expect(focused.isContentEditable).toBe(true);
	});
});
