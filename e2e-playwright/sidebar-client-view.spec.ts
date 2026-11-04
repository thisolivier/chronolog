/**
 * Sprint 039-CL: pinned notes, the client view, collapsing a client and reordering clients.
 * - Pin a note from its row: it moves to the top, keeps its pin after a reload, unpins.
 * - Click a client's name: `/notes/client/<id>` lists every contract's notes with contract labels;
 *   opening a note keeps that list; Back, Forward and reload follow the URL; New Note asks which contract.
 * - The chevron collapses a client (remembered per browser); a single-contract client has none.
 * - Alt+ArrowUp/Down moves a client, announced, and the order survives a reload.
 *
 * All Playwright specs share one user; every client here has a unique "Zeta 039 …" name.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editor } from './notes-helpers';

test.describe.configure({ mode: 'default' });

const SCREENSHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'review', 'screenshots', 'sprint-039');
const COLLAPSED_STORAGE_KEY = 'chronolog:sidebar-collapsed-clients';

const sidebar = (page: Page) => page.getByTestId('app-sidebar');
const clientGroup = (page: Page, clientName: string) =>
	sidebar(page).locator(`[data-testid="sidebar-client-group"][aria-label="${clientName}"]`);
const noteRows = (page: Page) => page.getByTestId('note-list-row');
const noteRow = (page: Page, noteId: string) => page.locator(`[data-testid="note-list-row"][data-note-id="${noteId}"]`);

type ClientSpec = { name: string; contracts: string[]; notesPerContract?: number };
type Seeded = { clientIds: string[]; contractIds: string[][]; noteIds: string[][][] };

function uniqueName(label: string) {
	return `Zeta 039 ${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
}

/** Clients, contracts and notes through the API; notes are created oldest first */
async function seedClients(page: Page, clients: ClientSpec[]): Promise<Seeded> {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
	return page.evaluate(
		async ({ clients, suffix }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url} ${response.status} ${await response.text()}`);
				return response.json();
			};
			const seeded = { clientIds: [] as string[], contractIds: [] as string[][], noteIds: [] as string[][][] };
			for (const [index, client] of clients.entries()) {
				const clientId = (await post('/api/clients', { name: client.name, shortCode: `Y${index}${suffix.slice(-6)}` })).client.id as string;
				const contractIds: string[] = [];
				const noteIds: string[][] = [];
				for (const contractName of client.contracts) {
					const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).id as string;
					contractIds.push(contractId);
					const contractNotes: string[] = [];
					for (let noteNumber = 1; noteNumber <= (client.notesPerContract ?? 0); noteNumber++) {
						const title = `${contractName} note ${noteNumber}`;
						contractNotes.push((await post('/api/notes', { contractId, title, content: `# ${title}\n\nBody ${noteNumber}` })).note.id);
					}
					noteIds.push(contractNotes);
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

async function rowOrder(page: Page): Promise<string[]> {
	return noteRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-note-id') ?? ''));
}

async function clientOrder(page: Page, names: string[]): Promise<string[]> {
	const labels = await sidebar(page)
		.locator('[data-testid="sidebar-client-group"]')
		.evaluateAll((groups) => groups.map((group) => group.getAttribute('aria-label') ?? ''));
	return labels.filter((label) => names.includes(label));
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript((key) => {
		if (!sessionStorage.getItem('sprint-039-initialised')) {
			localStorage.removeItem(key);
			sessionStorage.setItem('sprint-039-initialised', '1');
		}
	}, COLLAPSED_STORAGE_KEY);
});

test('pin a note: it moves to the top with a pin marker and stays there after a reload', async ({ page, browserName }) => {
	const clientName = uniqueName('Pins');
	const seeded = await seedClients(page, [{ name: clientName, contracts: ['Pin board'], notesPerContract: 3 }]);
	const [oldest, middle, newest] = seeded.noteIds[0][0];
	await page.goto(`/notes/${seeded.contractIds[0][0]}`);
	await expect(noteRows(page)).toHaveCount(3);
	expect(await rowOrder(page)).toEqual([newest, middle, oldest]);

	// Pin the oldest: it jumps to the top, its pin stays visible and pressed
	const pinToggle = noteRow(page, oldest).getByTestId('note-pin-toggle');
	await noteRow(page, oldest).hover();
	await pinToggle.click();
	await expect(pinToggle).toHaveAttribute('aria-pressed', 'true');
	expect(await rowOrder(page)).toEqual([oldest, newest, middle]);
	await expect(noteRow(page, oldest)).toHaveAttribute('data-pinned', 'true');

	// Server order agrees: reload keeps it on top; pinning does not touch updatedAt
	await page.reload();
	await expect(noteRows(page)).toHaveCount(3);
	expect(await rowOrder(page)).toEqual([oldest, newest, middle]);
	await page.mouse.move(0, 0);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '01-pinned-note-on-top.png') });

	// Unpin by keyboard: back in its place
	await noteRow(page, oldest).getByTestId('note-pin-toggle').focus();
	await page.keyboard.press('Enter');
	await expect(noteRow(page, oldest).getByTestId('note-pin-toggle')).toHaveAttribute('aria-pressed', 'false');
	expect(await rowOrder(page)).toEqual([newest, middle, oldest]);
});

test('client view: every contract’s notes, notes open inside it, the URL is the state', async ({ page, browserName }) => {
	const clientName = uniqueName('View');
	const seeded = await seedClients(page, [{ name: clientName, contracts: ['Alpha build', 'Beta audit'], notesPerContract: 2 }]);
	const [alphaNotes, betaNotes] = seeded.noteIds[0];
	const clientId = seeded.clientIds[0];
	const [alphaId, betaId] = seeded.contractIds[0];
	await page.goto(`/notes/${alphaId}`);
	await expect(noteRows(page)).toHaveCount(2);

	// Clicking the client's name opens its notes across both contracts, labelled with their contract
	const group = clientGroup(page, clientName);
	await group.getByTestId('sidebar-client-name').click();
	await expect(page).toHaveURL(new RegExp(`/notes/client/${clientId}$`));
	await expect(noteRows(page)).toHaveCount(4);
	await expect(page.getByTestId('note-list-context')).toContainText(clientName);
	await expect(page.getByTestId('note-list-context')).toContainText('All contracts');
	await expect(noteRow(page, alphaNotes[0]).getByTestId('note-row-contract')).toHaveText('Alpha build');
	await expect(noteRow(page, betaNotes[1]).getByTestId('note-row-contract')).toHaveText('Beta audit');
	await expect(group.getByTestId('sidebar-client-name')).toHaveAttribute('aria-current', 'page');
	await expect(page).toHaveTitle(new RegExp(clientName));

	// Pinned first in the client view too
	await noteRow(page, alphaNotes[0]).hover();
	await noteRow(page, alphaNotes[0]).getByTestId('note-pin-toggle').click();
	await expect.poll(() => rowOrder(page)).toEqual([alphaNotes[0], betaNotes[1], betaNotes[0], alphaNotes[1]]);
	await page.mouse.move(0, 0);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '02-client-view.png') });

	// Opening a note keeps the client view as the list; the URL carries client, contract and note
	await noteRow(page, betaNotes[0]).getByRole('button').first().click();
	await expect(page).toHaveURL(new RegExp(`/notes/client/${clientId}/${betaId}/${betaNotes[0].replace(/\./g, '\\.')}$`));
	await expect(editor(page)).toContainText('Beta audit note 1');
	await expect(noteRows(page)).toHaveCount(4);
	await expect(sidebar(page).locator(`[data-contract-id="${betaId}"]`)).toHaveAttribute('aria-current', 'page');

	// Reload: the same note in the same list
	await page.reload();
	await expect(editor(page)).toContainText('Beta audit note 1');
	await expect(noteRows(page)).toHaveCount(4);

	// Back: the client list; Back again: the contract list it came from; Forward: the client list
	await page.goBack();
	await expect(page).toHaveURL(new RegExp(`/notes/client/${clientId}$`));
	await expect(noteRows(page)).toHaveCount(4);
	await page.goBack();
	await expect(page).toHaveURL(new RegExp(`/notes/${alphaId}$`));
	await expect(noteRows(page)).toHaveCount(2);
	await page.goForward();
	await expect(page).toHaveURL(new RegExp(`/notes/client/${clientId}$`));
	await expect(noteRows(page)).toHaveCount(4);

	// New Note asks which contract; the draft opens for it inside the client view
	await page.getByRole('button', { name: 'New Note' }).click();
	const menu = page.getByTestId('new-note-contract-menu');
	await expect(menu).toBeVisible();
	await menu.getByRole('menuitem', { name: 'Beta audit' }).click();
	await expect(page).toHaveURL(new RegExp(`/notes/client/${clientId}/${betaId}/new$`));
	await expect(editor(page)).toBeFocused();
	await page.keyboard.type('Written from the client view');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
	await expect(noteRows(page)).toHaveCount(5);
	await expect(page).toHaveURL(new RegExp(`/notes/client/${clientId}/${betaId}/[A-Z0-9]+\\.\\d{8}\\.\\d{3}$`));
});

test('collapse a client: the chevron hides its contracts, the choice survives a reload', async ({ page, browserName }) => {
	const pairName = uniqueName('Fold');
	const soloName = uniqueName('Solo');
	const seeded = await seedClients(page, [
		{ name: pairName, contracts: ['First fold', 'Second fold'] },
		{ name: soloName, contracts: ['Only contract'] }
	]);
	await page.goto('/');
	const group = clientGroup(page, pairName);
	const chevron = group.getByTestId('sidebar-client-chevron');
	await expect(chevron).toHaveAttribute('aria-expanded', 'true');
	await expect(group.locator('[data-contract-id]')).toHaveCount(2);
	await expect(clientGroup(page, soloName).getByTestId('sidebar-client-chevron')).toHaveCount(0);

	await chevron.click();
	await expect(chevron).toHaveAttribute('aria-expanded', 'false');
	await expect(group.locator('[data-contract-id]')).toHaveCount(0);
	await expect(page).not.toHaveURL(/\/notes\/client\//); // the chevron only toggles
	if (browserName === 'chromium') {
		await group.scrollIntoViewIfNeeded();
		await page.mouse.move(0, 0);
		await page.waitForTimeout(300); // the chevron's rotation
		await page.screenshot({ path: path.join(SCREENSHOTS, '03-collapsed-client.png') });
	}

	await page.reload();
	await expect(clientGroup(page, pairName).getByTestId('sidebar-client-chevron')).toHaveAttribute('aria-expanded', 'false');
	await expect(clientGroup(page, pairName).locator('[data-contract-id]')).toHaveCount(0);

	// Opening one of its contracts by URL shows just that row; expanding shows both again
	await page.goto(`/notes/${seeded.contractIds[0][1]}`);
	await expect(clientGroup(page, pairName).locator('[data-contract-id]')).toHaveCount(1);
	await clientGroup(page, pairName).getByTestId('sidebar-client-chevron').click();
	await expect(clientGroup(page, pairName).locator('[data-contract-id]')).toHaveCount(2);
	await page.reload();
	await expect(clientGroup(page, pairName).getByTestId('sidebar-client-chevron')).toHaveAttribute('aria-expanded', 'true');
});

test('reorder clients with Alt+Arrow keys: announced, and the order survives a reload', async ({ page, browserName }) => {
	const firstName = uniqueName('Order A');
	const secondName = uniqueName('Order B');
	await seedClients(page, [
		{ name: firstName, contracts: ['A one', 'A two'] },
		{ name: secondName, contracts: ['B only'] }
	]);
	await page.goto('/');
	await expect(clientGroup(page, firstName)).toBeVisible();
	await expect(clientGroup(page, secondName)).toBeVisible();
	const names = [firstName, secondName];
	const before = await clientOrder(page, names);
	const [upper, lower] = before;

	// Move the upper client down past the lower one with the keyboard
	const handle = clientGroup(page, upper).locator('[data-client-reorder-handle]');
	await handle.focus();
	let presses = 0;
	while ((await clientOrder(page, names))[0] === upper && presses < 50) {
		await page.keyboard.press('Alt+ArrowDown');
		presses++;
	}
	expect(await clientOrder(page, names)).toEqual([lower, upper]);
	await expect(page.getByTestId('sidebar-reorder-announcement')).toContainText(`${upper} moved to position`);
	await expect(clientGroup(page, upper).locator('[data-client-reorder-handle]')).toBeFocused();
	if (browserName === 'chromium') {
		await clientGroup(page, upper).scrollIntoViewIfNeeded();
		await page.screenshot({ path: path.join(SCREENSHOTS, '04-sidebar-after-reorder.png') });
	}

	await expect.poll(async () => {
		await page.reload();
		await expect(clientGroup(page, upper)).toBeVisible();
		return clientOrder(page, names);
	}).toEqual([lower, upper]);

	// And back up with Alt+ArrowUp
	await clientGroup(page, upper).locator('[data-client-reorder-handle]').focus();
	while ((await clientOrder(page, names))[0] !== upper && presses < 100) {
		await page.keyboard.press('Alt+ArrowUp');
		presses++;
	}
	expect(await clientOrder(page, names)).toEqual([upper, lower]);
});

test('reorder clients by dragging a client heading onto another client', async ({ page }) => {
	const firstName = uniqueName('Drag A');
	const secondName = uniqueName('Drag B');
	await seedClients(page, [
		{ name: firstName, contracts: ['DA one', 'DA two'] },
		{ name: secondName, contracts: ['DB only'] }
	]);
	await page.goto('/');
	await expect(clientGroup(page, firstName)).toBeVisible();
	await expect(clientGroup(page, secondName)).toBeVisible();
	const names = [firstName, secondName];
	const [upper, lower] = await clientOrder(page, names);

	// Drop the upper client on the lower half of the lower one: it lands just after it
	const target = clientGroup(page, lower);
	const box = await target.boundingBox();
	await clientGroup(page, upper).locator('[data-client-reorder-handle]').dragTo(target, {
		targetPosition: { x: 40, y: (box?.height ?? 20) - 4 }
	});
	await expect.poll(() => clientOrder(page, names)).toEqual([lower, upper]);
	await expect.poll(async () => {
		await page.reload();
		await expect(clientGroup(page, upper)).toBeVisible();
		return clientOrder(page, names);
	}).toEqual([lower, upper]);
});
