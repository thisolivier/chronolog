/**
 * Sprint 033-CL: the sidebar's Archived item and single-contract rows.
 * - Task 2: archiving and restoring in Settings shows in the sidebar after in-app navigation only.
 * - Task 3: a client with one active contract is one row; a second contract brings the heading back.
 * - Task 4: opening a note on a single-contract or archived contract highlights the right row, and
 *   an archived selection expands the Archived item.
 * - Task 5: the toggle is a button with aria-expanded, remembered per browser; same structure at 390 px.
 *
 * All Playwright specs share one user, so every client here has a unique name that sorts after the
 * others ("Zeta 033 …"): other specs add contracts to the user's first client.
 */
import { test, expect, type Page } from '@playwright/test';
import { expectNotesScopedTo } from './notes-helpers';

// In order, in one worker: the archive journeys change the shared sidebar
test.describe.configure({ mode: 'default' });

const ARCHIVED_STORAGE_KEY = 'chronolog:sidebar-archived-expanded';

async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

const sidebar = (page: Page) => page.getByTestId('app-sidebar');
const contractRow = (page: Page, contractId: string) => sidebar(page).locator(`[data-contract-id="${contractId}"]`);
const archivedSection = (page: Page) => sidebar(page).getByTestId('sidebar-archived-section');
const archivedToggle = (page: Page) => sidebar(page).getByTestId('sidebar-archived-toggle');
const activeGroup = (page: Page, clientName: string) =>
	sidebar(page).locator(`[data-testid="sidebar-client-group"][aria-label="${clientName}"]`);

function todayIso(): string {
	const today = new Date();
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

type ClientSpec = { name: string; contracts: string[]; notes?: boolean };
type Seeded = { clientIds: string[]; contractIds: string[][]; noteIds: string[][] };

/** Clients with contracts (and one note per contract when asked) through the API */
async function seedClients(page: Page, clients: ClientSpec[]): Promise<Seeded> {
	await open(page, '/');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
	return page.evaluate(
		async ({ clients, suffix }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url} ${response.status} ${await response.text()}`);
				return response.json();
			};
			const seeded = { clientIds: [] as string[], contractIds: [] as string[][], noteIds: [] as string[][] };
			for (const [index, client] of clients.entries()) {
				const shortCode = `Z${index}${suffix.slice(-6)}`;
				const clientId = (await post('/api/clients', { name: client.name, shortCode })).client.id as string;
				const contractIds: string[] = [];
				const noteIds: string[] = [];
				for (const contractName of client.contracts) {
					const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).id as string;
					contractIds.push(contractId);
					if (client.notes) {
						noteIds.push((await post('/api/notes', { contractId, title: `${contractName} note`, content: `${contractName} note` })).note.id);
					}
				}
				seeded.clientIds.push(clientId);
				seeded.contractIds.push(contractIds);
				seeded.noteIds.push(noteIds);
			}
			return seeded;
		},
		{ clients, suffix }
	);
}

async function patch(page: Page, url: string, body: unknown) {
	const status = await page.evaluate(
		async ({ url, body }) =>
			(await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status,
		{ url, body }
	);
	expect(status).toBe(200);
}

function uniqueName(label: string) {
	return `Zeta 033 ${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
}

/** Settings → Clients and contracts, by clicking links only */
async function goToClientsSettings(page: Page) {
	await sidebar(page).getByRole('link', { name: 'Settings', exact: true }).click();
	await page.getByRole('link', { name: /Clients and contracts/ }).click();
	await expect(page).toHaveURL(/\/admin\/clients$/);
}

async function backToApp(page: Page) {
	await page.getByRole('link', { name: 'Back to app' }).click();
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript((key) => {
		// Each test starts with the Archived item at its default (collapsed), once per test
		if (!sessionStorage.getItem('sprint-033-initialised')) {
			localStorage.removeItem(key);
			sessionStorage.setItem('sprint-033-initialised', '1');
		}
	}, ARCHIVED_STORAGE_KEY);
});

test('task 3: a client with one active contract is one row; a second contract brings the heading back', async ({ page }) => {
	const soloName = uniqueName('Solo');
	const pairName = uniqueName('Pair');
	const data = await seedClients(page, [
		{ name: soloName, contracts: ['Retainer', 'Old Phase'] },
		{ name: pairName, contracts: ['Build', 'Run'] }
	]);
	const [retainer, oldPhase] = data.contractIds[0];
	// An archived contract does not count towards the one
	await patch(page, `/api/contracts/${oldPhase}`, { archived: true });
	await open(page, '/');

	const soloGroup = activeGroup(page, soloName);
	await expect(soloGroup.getByTestId('sidebar-single-contract-row')).toHaveCount(1);
	await expect(soloGroup.getByTestId('sidebar-client-heading')).toHaveCount(0);
	const soloRow = contractRow(page, retainer);
	await expect(soloRow).toContainText('Retainer');
	await expect(soloRow.getByTestId('sidebar-row-client-name')).toHaveText(soloName);
	// 053-DR: the colour dot became the contract mark (client colour + initials)
	await expect(soloRow.getByTestId('contract-mark')).toHaveCount(1);

	// Two active contracts keep the heading plus children
	const pairGroup = activeGroup(page, pairName);
	await expect(pairGroup.getByTestId('sidebar-client-heading')).toContainText(pairName);
	await expect(pairGroup.locator('[data-contract-id]')).toHaveCount(2);
	await expect(pairGroup.getByTestId('sidebar-single-contract-row')).toHaveCount(0);

	// Selectable like any contract; the panels still read "Client / Contract"
	await soloRow.click();
	await expect(page).toHaveURL(`/notes/${retainer}`);
	await expect(soloRow).toHaveAttribute('aria-current', 'page');
	await expect(soloRow).toHaveClass(/bg-surface/);
	// 054-DR: the sidebar row names the contract; the list is scoped to it
	await expectNotesScopedTo(page, retainer, { editorToo: false });

	// A second active contract: the client expands back on the next directory refresh
	await patch(page, `/api/contracts/${oldPhase}`, { archived: false });
	await page.evaluate(() => window.dispatchEvent(new Event('notes-changed')));
	await expect(soloGroup.getByTestId('sidebar-client-heading')).toContainText(soloName);
	await expect(soloGroup.locator('[data-contract-id]')).toHaveCount(2);
	await expect(soloGroup.getByTestId('sidebar-single-contract-row')).toHaveCount(0);
	await expect(contractRow(page, retainer)).toHaveAttribute('aria-current', 'page');
});

test('task 2: archiving and restoring in Settings moves the client in the sidebar without a reload', async ({ page }) => {
	const clientName = uniqueName('Archive');
	const mixedName = uniqueName('Mixed');
	const data = await seedClients(page, [
		{ name: clientName, contracts: ['Discovery'], notes: true },
		{ name: mixedName, contracts: ['Current', 'Wrap Up'], notes: true }
	]);
	const discovery = data.contractIds[0][0];
	const [current, wrapUp] = data.contractIds[1];
	await open(page, '/');
	await page.evaluate(() => ((window as unknown as { loadedOnce: boolean }).loadedOnce = true));
	await expect(activeGroup(page, clientName)).toBeVisible();

	// Archive the client: Delete offers Archive because it has a note
	await goToClientsSettings(page);
	const clientRow = page.locator(`tr[data-client-id="${data.clientIds[0]}"]`);
	await clientRow.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('button', { name: 'Archive', exact: true }).click();
	await expect(clientRow.getByText('Archived', { exact: true })).toBeVisible();

	// Archive one contract of the other client on its page
	await page.getByRole('link', { name: mixedName }).click();
	const wrapUpRow = page.locator(`[data-contract-id="${wrapUp}"]`);
	await wrapUpRow.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('button', { name: 'Archive', exact: true }).click();
	await expect(wrapUpRow.getByText('Archived', { exact: true })).toBeVisible();

	await backToApp(page);
	// The archived client left the active list and sits under Archived (collapsed by default)
	await expect(activeGroup(page, clientName)).toHaveCount(0);
	await expect(archivedToggle(page)).toHaveAttribute('aria-expanded', 'false');
	await expect(contractRow(page, discovery)).toBeHidden();
	await archivedToggle(page).click();
	await expect(archivedToggle(page)).toHaveAttribute('aria-expanded', 'true');
	const archivedClient = archivedSection(page).locator(`[aria-label="${clientName}"]`);
	await expect(archivedClient.locator(`[data-contract-id="${discovery}"]`)).toBeVisible();
	// The archived contract of an active client is listed under its client's name in Archived,
	// and the client now has one active contract: a single row
	await expect(archivedSection(page).locator(`[aria-label="${mixedName}"] [data-contract-id="${wrapUp}"]`)).toBeVisible();
	await expect(activeGroup(page, mixedName).getByTestId('sidebar-single-contract-row')).toHaveAttribute('data-contract-id', current);

	// Restore both in Settings: back in the active list
	await goToClientsSettings(page);
	await clientRow.getByRole('button', { name: 'Activate' }).click();
	await expect(clientRow.getByText('Archived', { exact: true })).toHaveCount(0);
	await page.getByRole('link', { name: mixedName }).click();
	await wrapUpRow.getByRole('button', { name: 'Activate' }).click();
	await expect(wrapUpRow.getByText('Archived', { exact: true })).toHaveCount(0);
	await backToApp(page);
	await expect(activeGroup(page, clientName).locator(`[data-contract-id="${discovery}"]`)).toBeVisible();
	await expect(activeGroup(page, mixedName).locator('[data-contract-id]')).toHaveCount(2);
	await expect(archivedSection(page).locator(`[data-contract-id="${discovery}"]`)).toHaveCount(0);

	expect(await page.evaluate(() => (window as unknown as { loadedOnce?: boolean }).loadedOnce)).toBe(true);
});

test('task 4: landing on a single-contract note by URL highlights its row', async ({ page }) => {
	const clientName = uniqueName('Deep');
	const data = await seedClients(page, [{ name: clientName, contracts: ['Advisory'], notes: true }]);
	const [advisory] = data.contractIds[0];
	const [noteId] = data.noteIds[0];

	await open(page, `/notes/${advisory}/${noteId}`);
	const row = contractRow(page, advisory);
	await expect(row).toHaveAttribute('data-testid', 'sidebar-single-contract-row');
	await expect(row).toHaveAttribute('aria-current', 'page');
	await expect(row).toBeInViewport();
	await expect(page.getByTestId('note-editor-context')).toHaveAttribute('data-contract-id', advisory);
	await expect(page.getByTestId('note-editor-context')).toHaveAttribute('data-visible', 'false');
});

test('task 4: a timesheet wiki-link to a note on an archived contract opens it and expands Archived', async ({ page }) => {
	const liveName = uniqueName('Live');
	const goneName = uniqueName('Gone');
	const data = await seedClients(page, [
		{ name: liveName, contracts: ['Ongoing'] },
		{ name: goneName, contracts: ['Closed Out', 'Handover'], notes: true }
	]);
	const [ongoing] = data.contractIds[0];
	const [closedOut] = data.contractIds[1];
	const [archivedNoteId] = data.noteIds[1];
	await page.evaluate(
		async ({ date, contractId, noteId }) => {
			const response = await fetch('/api/time-entries', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ date, durationMinutes: 30, contractId, description: `Follow-up on [[${noteId}]]` })
			});
			if (!response.ok) throw new Error(`time entry ${response.status}`);
		},
		{ date: todayIso(), contractId: ongoing, noteId: archivedNoteId }
	);
	await patch(page, `/api/clients/${data.clientIds[1]}`, { archived: true });

	await open(page, '/time');
	await expect(archivedToggle(page)).toHaveAttribute('aria-expanded', 'false');
	await page.getByTitle(archivedNoteId).first().click();
	await expect(page).toHaveURL(`/notes/${closedOut}/${archivedNoteId}`);
	await expect(archivedToggle(page)).toHaveAttribute('aria-expanded', 'true');
	const row = archivedSection(page).locator(`[data-contract-id="${closedOut}"]`);
	await expect(row).toHaveAttribute('aria-current', 'page');
	await expect(row).toBeInViewport();
	await expectNotesScopedTo(page, closedOut, { editorToo: false });

	// The expansion is for this selection only: the remembered choice is still collapsed
	expect(await page.evaluate((key) => localStorage.getItem(key), ARCHIVED_STORAGE_KEY)).toBeNull();
	// A deep link to the archived note expands it too
	await open(page, `/notes/${closedOut}/${archivedNoteId}`);
	await expect(archivedToggle(page)).toHaveAttribute('aria-expanded', 'true');
	await expect(contractRow(page, closedOut)).toHaveAttribute('aria-current', 'page');
});

test('task 5: the Archived toggle works from the keyboard, is remembered, and the phone shows the same structure', async ({ page, browserName }) => {
	const clientName = uniqueName('Keys');
	const data = await seedClients(page, [{ name: clientName, contracts: ['Shelved'] }]);
	const [shelved] = data.contractIds[0];
	await patch(page, `/api/contracts/${shelved}`, { archived: true });
	await open(page, '/');

	const toggle = archivedToggle(page);
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(toggle).toHaveAttribute('aria-controls', 'sidebar-archived-list');
	await expect(sidebar(page).getByTestId('sidebar-archived-count')).not.toHaveText('0');
	await toggle.focus();
	await page.keyboard.press('Enter');
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	// Tab moves from the toggle into the archived rows (WebKit, like Safari, needs Option+Tab for buttons)
	await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
	await expect(page.locator(':focus')).toHaveAttribute('data-contract-id', /.+/);
	expect(await page.evaluate((key) => localStorage.getItem(key), ARCHIVED_STORAGE_KEY)).toBe('true');

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(archivedToggle(page)).toHaveAttribute('aria-expanded', 'true');
	await expect(contractRow(page, shelved)).toBeVisible();

	// Phone: the sidebar is the home screen, with the same rows and the Archived item
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, '/');
	const phoneToggle = page.getByTestId('sidebar-archived-toggle');
	await expect(phoneToggle).toBeVisible();
	await expect(phoneToggle).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator(`[data-contract-id="${shelved}"]`)).toBeVisible();
	await phoneToggle.click();
	await expect(phoneToggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.locator(`[data-contract-id="${shelved}"]`)).toBeHidden();
});
