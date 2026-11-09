/**
 * Sprint 053-DR (design r1 SH-04, SH-06, TC-02, TC-06): one visible timer.
 * The header reflection shows only when no timer widget is on screen (SH-02 state matrix):
 * desktop expanded or collapsed sidebar timer → none; sidebar hidden → the running reflection;
 * stopped unfinished → "Finish entry" with the frozen duration; phone note screen → reflection,
 * phone capture screen (home) → none. Collapse is presentation only and the completion fields
 * live in the shared capture store, so they survive /settings and the 768px crossing.
 * Screenshots: `UPDATE_SPRINT_SCREENSHOTS=1` writes them to docs/review/screenshots/sprint-053/.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';
import { chooseTimerContract } from './timer-contract-picker';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-053');

type Seeded = { clientName: string; contractId: string; contractName: string; otherContractName: string; noteId: string };

async function open(page: Page, target: string) {
	await page.goto(target);
	await page.waitForLoadState('networkidle');
}

/** A client with two contracts and a note in the first */
async function seed(page: Page, label: string): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await open(page, '/');
	return page.evaluate(
		async ({ suffix, label }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url}: ${response.status}`);
				return response.json();
			};
			const clientName = `Amplitude ${label}`;
			const contractName = `Hungryroot ${suffix}`;
			const otherContractName = `Rank Group ${suffix}`;
			const clientId = (await post('/api/clients', { name: clientName, shortCode: `A${suffix.slice(-5).toUpperCase()}` })).client.id;
			const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).contract.id;
			await post('/api/contracts', { clientId, name: otherContractName, isActive: true });
			const noteId = (await post('/api/notes', { contractId, title: `Kick-off ${suffix}`, content: `# Kick-off ${suffix}\n\nAgenda.` })).note.id;
			return { clientName, contractId, contractName, otherContractName, noteId };
		},
		{ suffix, label }
	);
}

const widget = (page: Page) => page.getByTestId('timer-widget-sidebar');
const headerPill = (page: Page) => page.getByTestId('timer-indicator');
const collapseToggle = (page: Page) => widget(page).getByTestId('timer-collapse-toggle');

test.describe('desktop 1280', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('expanded, collapsed and hidden: exactly one timer representation at a time', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'timer-visibility-desktop');
		const data = await seed(page, 'TV');
		await open(page, `/notes/${data.contractId}/${data.noteId}`);
		await widget(page).getByRole('button', { name: 'Start Timer' }).click();
		await expect.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null)).not.toBeNull();

		// TC-02 identity: contract first, client as subtitle, no RECORDING (no running light since 064-DR)
		const identity = widget(page).getByTestId('timer-identity');
		await expect(identity.getByTestId('timer-identity-contract')).toHaveText(data.contractName);
		await expect(identity.getByTestId('timer-identity-client')).toHaveText(data.clientName);
		await expect(widget(page)).not.toContainText(/recording/i);
		await expect(widget(page).getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		// The contract is chosen from the header's "Change" menu (064-DR); the chevron is not a selector
		await expect(widget(page).getByRole('combobox')).toHaveCount(0);
		await widget(page).getByRole('button', { name: 'Change contract' }).click();
		const contractMenu = page.getByTestId('timer-contract-menu');
		await expect(contractMenu.getByRole('menuitemradio', { checked: true })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(contractMenu).toHaveCount(0);
		await expect(widget(page).getByRole('button', { name: 'Change contract' })).toBeFocused();
		await expect(identity.getByTestId('timer-identity-contract')).toHaveText(data.contractName);

		// Expanded sidebar timer: no header duplicate
		await expect(headerPill(page)).toHaveCount(0);
		await page.screenshot({ path: path.join(SCREENSHOTS, '01-desktop-notes-expanded-timer.png') });

		// Collapsed: the compact widget, still no header duplicate, the description survives
		await widget(page).locator('#draft-description').fill('Planning the kick-off');
		await collapseToggle(page).click();
		await expect(widget(page).getByTestId('timer-compact')).toBeVisible();
		await expect(widget(page).getByTestId('timer-compact-clock')).toHaveText(/^\d\d:\d\d:\d\d$/);
		await expect(widget(page).getByTestId('timer-widget-body')).toBeHidden();
		await expect(headerPill(page)).toHaveCount(0);
		await page.screenshot({ path: path.join(SCREENSHOTS, '02-desktop-collapsed-timer.png') });
		await collapseToggle(page).click();
		await expect(widget(page).locator('#draft-description')).toHaveValue('Planning the kick-off');

		// Keyboard: Enter on the chevron toggles and focus stays on the chevron both ways
		await collapseToggle(page).focus();
		await page.keyboard.press('Enter');
		await expect(widget(page).getByTestId('timer-compact')).toBeVisible();
		await expect(collapseToggle(page)).toBeFocused();
		await expect(collapseToggle(page)).toHaveAttribute('aria-expanded', 'false');
		await page.keyboard.press('Enter');
		await expect(widget(page).getByTestId('timer-identity')).toBeVisible();
		await expect(collapseToggle(page)).toBeFocused();
		await expect(collapseToggle(page)).toHaveAttribute('aria-expanded', 'true');

		// Sidebar hidden (the widget stays mounted at 0px): the header reflects the capture, but
		// only once the 300ms width animation is over, so the two never show together
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		expect(await headerPill(page).count()).toBe(0);
		await expect(headerPill(page)).toBeVisible();
		await expect(headerPill(page)).toHaveAttribute('data-state', 'running');
		await expect(headerPill(page)).toContainText(data.contractName);
		await expect(headerPill(page)).toContainText(data.clientName);
		await expect(headerPill(page).getByTestId('timer-indicator-clock')).toHaveText(/^\d\d:\d\d:\d\d$/);
		// It names the capture, not the browsed contract
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await page.getByTestId('app-sidebar').getByRole('button', { name: new RegExp(`^${data.otherContractName}`) }).click();
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(headerPill(page)).toContainText(data.contractName);
		await expect(headerPill(page)).not.toContainText(data.otherContractName);
		await page.screenshot({ path: path.join(SCREENSHOTS, '04-desktop-hidden-sidebar-header-pill.png') });
		// Clicking it shows the sidebar, where the same widget lives; the pill goes
		await headerPill(page).click();
		await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute('aria-expanded', 'true');
		await expect(headerPill(page)).toHaveCount(0);
		await expect(widget(page).locator('#draft-description')).toHaveValue('Planning the kick-off');
	});

	test('stopped unfinished: Finish entry, frozen time, fields survive collapse, /settings and 768px', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'timer-finish-desktop');
		const data = await seed(page, 'TF');
		await open(page, `/notes/${data.contractId}`);
		await widget(page).getByRole('button', { name: 'Start Timer' }).click();
		await expect.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null)).not.toBeNull();
		await widget(page).getByRole('button', { name: 'Stop', exact: true }).click();
		await expect(widget(page).getByRole('button', { name: 'Save', exact: true })).toBeVisible();
		await expect(widget(page).getByTestId('timer-identity')).toHaveAttribute('data-state', 'stopped');

		await widget(page).locator('#timer-description').fill('Wrote the agenda');
		await widget(page).locator('#timer-time').fill('1h 15m');
		await page.screenshot({ path: path.join(SCREENSHOTS, '06-desktop-stopped-unfinished.png') });

		// Compact: Finish entry with the frozen duration
		await collapseToggle(page).click();
		const compact = widget(page).getByTestId('timer-compact');
		await expect(compact).toContainText('Finish entry');
		const frozen = await compact.getByTestId('timer-compact-frozen').innerText();
		await expect(headerPill(page)).toHaveCount(0);

		// Hidden sidebar: the header reads Finish entry, frozen, no running state
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await expect(headerPill(page)).toHaveAttribute('data-state', 'finish');
		await expect(headerPill(page)).toContainText('Finish entry');
		await expect(headerPill(page).getByTestId('timer-indicator-frozen')).toHaveText(frozen);
		await page.waitForTimeout(1500);
		await expect(headerPill(page).getByTestId('timer-indicator-frozen')).toHaveText(frozen);
		await page.getByTestId('app-top-bar').screenshot({ path: path.join(SCREENSHOTS, '06b-desktop-header-finish-entry.png') });
		await page.getByRole('button', { name: 'Toggle sidebar' }).click();
		await collapseToggle(page).click();

		// Off-shell route and back: the widget remounts and finds the same fields
		await open(page, '/settings');
		await open(page, `/notes/${data.contractId}`);
		await expect(widget(page).locator('#timer-description')).toHaveValue('Wrote the agenda');
		await expect(widget(page).locator('#timer-time')).toHaveValue('1h 15m');

		// Across the 768px breakpoint (the shell swaps DOM branches) and back
		await page.setViewportSize({ width: 600, height: 800 });
		await expect(page.getByTestId('app-top-bar')).toHaveCount(0);
		await page.setViewportSize({ width: 1280, height: 800 });
		await expect(widget(page).locator('#timer-description')).toHaveValue('Wrote the agenda');
		await expect(widget(page).locator('#timer-time')).toHaveValue('1h 15m');

		// The server moves the stopped draft's start (a split or move from another device): the
		// stored time text is stale, so after a reload the Time field shows the server's interval,
		// while the description survives
		test.skip(new Date().getHours() < 1, 'needs 30 minutes of today behind the start');
		const moved = await page.evaluate(async () => {
			const timer = (await (await fetch('/api/timer/status')).json()).timer;
			const [hours, minutes] = (timer.startTime as string).split(':').map(Number);
			const earlier = hours * 60 + minutes - 30;
			const startTime = `${String(Math.floor(earlier / 60)).padStart(2, '0')}:${String(earlier % 60).padStart(2, '0')}`;
			const response = await fetch('/api/timer', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ startTime, confirmed: true })
			});
			return { status: response.status, startTime };
		});
		expect(moved.status).toBe(200);
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(widget(page).locator('#timer-time')).toHaveValue(new RegExp(`^${moved.startTime}-\\d\\d:\\d\\d$`));
		await expect(widget(page).locator('#timer-description')).toHaveValue('Wrote the agenda');

		// Discard resolves it: nothing left to finish, the stored fields are gone
		await widget(page).getByRole('button', { name: 'Discard', exact: true }).click();
		await expect(widget(page).getByRole('button', { name: 'Start Timer' })).toBeVisible();
		const storedKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('chronolog:capture-draft:')));
		expect(storedKeys).toEqual([]);
	});
});

test.describe('phone 390 @iphone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('note screens show the reflection; the capture screen does not; Finish entry survives Back and reload', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'timer-visibility-phone');
		const data = await seed(page, 'TP');
		await open(page, '/');
		const phoneWidget = page.locator('[data-testid^="timer-widget-"]').first();
		await phoneWidget.getByRole('button', { name: 'Start Timer' }).click();
		await chooseTimerContract(page, phoneWidget, { id: data.contractId });
		await expect.poll(async () => page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer?.id ?? null)).not.toBeNull();
		// The focused capture (home) has no collapse chevron and no header duplicate
		await expect(phoneWidget.getByTestId('timer-collapse-toggle')).toHaveCount(0);
		await expect(headerPill(page)).toHaveCount(0);

		// A note screen: the reflection, with the capture's own identity
		await open(page, `/notes/${data.contractId}/${data.noteId}`);
		await expect(headerPill(page)).toBeVisible();
		await expect(headerPill(page)).toHaveAttribute('data-state', 'running');
		const firstClock = await headerPill(page).getByTestId('timer-indicator-clock').innerText();
		await expect.poll(() => headerPill(page).getByTestId('timer-indicator-clock').innerText(), { timeout: 4000 }).not.toBe(firstClock);
		await page.screenshot({ path: path.join(SCREENSHOTS, '05-iphone-notes-header-pill.png') });

		// Tapping it opens the focused capture screen over the note (sprint 055-DR, TC-08)
		const captureScreen = page.getByTestId('phone-capture-screen');
		const screenWidget = page.getByTestId('timer-widget-screen');
		await headerPill(page).click();
		await expect(captureScreen).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`/notes/${data.contractId}/`));
		await expect(headerPill(page)).toHaveCount(0);
		await expect(screenWidget.getByTestId('timer-collapse-toggle')).toHaveCount(0);
		await screenWidget.getByRole('button', { name: 'Stop', exact: true }).click();
		await screenWidget.locator('#timer-description').fill('Phone notes');

		// Back to the note: Finish entry with the frozen duration; reload keeps it
		await page.getByTestId('capture-screen-back').click();
		await expect(captureScreen).toHaveCount(0);
		await expect(headerPill(page)).toHaveAttribute('data-state', 'finish');
		await expect(headerPill(page)).toContainText('Finish entry');
		await page.reload();
		await expect(headerPill(page)).toHaveAttribute('data-state', 'finish');
		await page.screenshot({ path: path.join(SCREENSHOTS, '07-iphone-finish-entry.png') });
		await headerPill(page).click();
		await expect(screenWidget.locator('#timer-description')).toHaveValue('Phone notes');
		await screenWidget.getByRole('button', { name: 'Discard', exact: true }).click();
		await expect(captureScreen).toHaveCount(0);
		await expect(headerPill(page)).toHaveCount(0);
	});
});
