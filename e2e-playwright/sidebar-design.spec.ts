/**
 * Sprint 053-DR (design r1 SH-02, SH-03, DS-05): the sidebar's grouping, selection and muting.
 * - A multi-contract client is a pale tinted section; its heading has no colour dot; each row has
 *   a ContractMark; a one-contract client stays a flattened row at the outer inset.
 * - The selected contract is a punch-out in the surface colour, not a blue/pine wash.
 * - Time Entries mutes the whole Notes section (plus Archived, Trash, Settings) with one 50%
 *   wrapper; Time Entries and the timer stay at full opacity; nothing drops below 50%; every
 *   control stays clickable and keyboard reachable.
 * Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to docs/review/screenshots/sprint-053/.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-053');

test.use({ viewport: { width: 1280, height: 800 } });

type Seeded = { groupClient: string; soloClient: string; contractId: string; contractName: string; inactiveName: string; archivedName: string; soloName: string };

async function seed(page: Page): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	return page.evaluate(async (suffix) => {
		const send = async (method: string, url: string, body: unknown) => {
			const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status}`);
			return response.json();
		};
		const groupClient = `Amplitude ${suffix}`;
		const soloClient = `EasyJet ${suffix}`;
		const groupClientId = (await send('POST', '/api/clients', { name: groupClient, shortCode: `A${suffix.slice(-5).toUpperCase()}` })).client.id;
		const contractName = `Hungryroot ${suffix}`;
		const contractId = (await send('POST', '/api/contracts', { clientId: groupClientId, name: contractName, isActive: true })).contract.id;
		await send('POST', '/api/contracts', { clientId: groupClientId, name: `Daily Pay ${suffix}`, isActive: true });
		const inactiveName = `Thmanyah ${suffix}`;
		await send('POST', '/api/contracts', { clientId: groupClientId, name: inactiveName, isActive: false });
		const archivedName = `Old phase ${suffix}`;
		const archivedId = (await send('POST', '/api/contracts', { clientId: groupClientId, name: archivedName, isActive: true })).contract.id;
		await send('PATCH', `/api/contracts/${archivedId}`, { archived: true });
		const soloClientId = (await send('POST', '/api/clients', { name: soloClient, shortCode: `E${suffix.slice(-5).toUpperCase()}` })).client.id;
		const soloName = `Retainer ${suffix}`;
		await send('POST', '/api/contracts', { clientId: soloClientId, name: soloName, isActive: true });
		await send('POST', '/api/notes', { contractId, title: `Note ${suffix}`, content: `# Note ${suffix}` });
		return { groupClient, soloClient, contractId, contractName, inactiveName, archivedName, soloName };
	}, suffix);
}

const sidebar = (page: Page) => page.getByTestId('app-sidebar');
const contractRow = (page: Page, name: string) => sidebar(page).getByRole('button', { name: new RegExp(`^${name}`) }).first();

/** The opacity a viewer sees: the product of the element's and every ancestor's opacity */
async function effectiveOpacity(locator: Locator): Promise<number> {
	return locator.evaluate((element) => {
		let opacity = 1;
		for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
		return Math.round(opacity * 100) / 100;
	});
}

const backgroundOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);
const cssColour = (page: Page, token: string) =>
	page.evaluate((token) => {
		const probe = document.createElement('div');
		probe.style.backgroundColor = `var(${token})`;
		document.body.append(probe);
		const colour = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return colour;
	}, token);

test('client groups are tinted, rows carry marks, the selection is a surface punch-out', async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'sidebar-design');
	const data = await seed(page);
	await page.goto(`/notes/${data.contractId}`);
	await page.waitForLoadState('networkidle');

	const group = sidebar(page).locator(`[data-testid="sidebar-client-group"][aria-label="${data.groupClient}"]`);
	expect(await backgroundOf(group)).toBe(await cssColour(page, '--color-sunken'));
	// No decorative colour dot by the client name; marks on every contract row
	await expect(group.getByTestId('sidebar-client-heading').locator('.rounded-full')).toHaveCount(0);
	await expect(group.getByTestId('contract-mark')).toHaveCount(3);
	const selected = contractRow(page, data.contractName);
	await expect(selected).toHaveAttribute('aria-current', 'page');
	expect(await backgroundOf(selected)).toBe(await cssColour(page, '--color-surface'));
	await expect(selected).not.toHaveClass(/pine|blue/);
	await expect(selected.getByTestId('sidebar-note-count')).toHaveText('1');

	// Mark-to-name gap is the DS-05 token, the count sits at the right
	const mark = selected.getByTestId('contract-mark');
	const markBox = (await mark.boundingBox())!;
	const nameBox = (await selected.locator('span.truncate').first().boundingBox())!;
	expect(Math.round(nameBox.x - (markBox.x + markBox.width))).toBe(5);
	const countBox = (await selected.getByTestId('sidebar-note-count').boundingBox())!;
	const rowBox = (await selected.boundingBox())!;
	expect(rowBox.x + rowBox.width - (countBox.x + countBox.width)).toBeLessThanOrEqual(12);

	// The one-contract client stays flattened at the outer inset: its mark sits left of the group's
	const solo = sidebar(page).locator(`[data-testid="sidebar-client-group"][aria-label="${data.soloClient}"]`);
	await expect(solo.getByTestId('sidebar-single-contract-row')).toBeVisible();
	await expect(solo.getByTestId('sidebar-row-client-name')).toHaveText(data.soloClient);
	expect(await backgroundOf(solo)).not.toBe(await cssColour(page, '--color-sunken'));
	const soloMarkBox = (await solo.getByTestId('contract-mark').boundingBox())!;
	expect(soloMarkBox.x).toBeLessThan(markBox.x);
	await sidebar(page).screenshot({ path: path.join(SCREENSHOTS, '08-sidebar-selected-contract.png') });
});

test('Time Entries mutes Notes, Archived, Trash and Settings as one group that stays operable', async ({ page, baseURL }) => {
	await signInAsFreshUser(page, baseURL, 'sidebar-mute');
	const data = await seed(page);
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('sidebar-archived-toggle').click();

	const notesSection = sidebar(page).getByTestId('sidebar-notes-section');
	await expect(notesSection).toHaveAttribute('data-muted', 'true');
	await expect.poll(() => effectiveOpacity(notesSection)).toBe(0.5);
	expect(await effectiveOpacity(page.getByRole('button', { name: 'Time Entries' }))).toBe(1);
	expect(await effectiveOpacity(page.getByTestId('timer-widget-sidebar'))).toBe(1);
	// Archived, Trash and Settings are inside the one wrapper
	for (const testId of ['sidebar-archived-toggle', 'sidebar-trash-link', 'sidebar-settings-link', 'sidebar-notes-heading']) {
		expect(await effectiveOpacity(sidebar(page).getByTestId(testId))).toBe(0.5);
	}
	// Inactive and archived rows and their marks never stack to 25%
	for (const name of [data.inactiveName, data.archivedName]) {
		const row = contractRow(page, name);
		expect(await effectiveOpacity(row)).toBe(0.5);
		expect(await effectiveOpacity(row.getByTestId('contract-mark'))).toBe(0.5);
	}
	await page.screenshot({ path: path.join(SCREENSHOTS, '03-desktop-time-entries-muted-sidebar.png') });

	// Still enabled and keyboard reachable: Tab onto a contract and open it with Enter
	const target = contractRow(page, data.contractName);
	await expect(target).toBeEnabled();
	await target.focus();
	await expect(target).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`/notes/${data.contractId}$`));
	await expect(notesSection).toHaveAttribute('data-muted', 'false');
	await expect.poll(() => effectiveOpacity(notesSection)).toBe(1);
	// Inactive rows are muted by colour when the section is not
	expect(await effectiveOpacity(contractRow(page, data.inactiveName))).toBe(1);

	// And by mouse, from the muted state
	await page.getByRole('button', { name: 'Time Entries' }).click();
	await expect(notesSection).toHaveAttribute('data-muted', 'true');
	await sidebar(page).getByTestId('sidebar-settings-link').click();
	await expect(page).toHaveURL(/\/settings/);
});
