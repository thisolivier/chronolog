/**
 * Sprint 064-DR, T3 / T4 (timer): no running light, and the running timer's contract is chosen
 * from its identity header. No contract yet: no pattern region, "No contract yet" and "Select".
 * "Select" / "Change" drop a menu of contracts from the heading; an outside click or Escape closes
 * it with nothing changed; choosing creates the server draft (or moves it) and shows the tile;
 * collapsing the widget closes it. The menu is wholly on screen (not clipped) in the 240 px
 * sidebar and on the phone capture screen, whose own Escape it does not trigger.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import { signInAsFreshUser } from './fresh-user';
import { contractMenu } from './timer-contract-picker';

type Seeded = { clientName: string; firstId: string; firstName: string; secondId: string; secondName: string };

async function seed(page: Page, label: string): Promise<Seeded> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await page.goto('/');
	// Let the app's own navigations after load settle (the root layout's afterNavigate may replace
	// the URL with `/` once the document has loaded), or the caller's next goto is reported as
	// "interrupted by another navigation" under load (WebKit, iPhone projects)
	await page.waitForLoadState('networkidle');
	return page.evaluate(
		async ({ suffix, label }) => {
			const post = async (url: string, body: unknown) => {
				const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				if (!response.ok) throw new Error(`${url}: ${response.status}`);
				return response.json();
			};
			const clientName = `Amplitude ${label}`;
			const clientId = (await post('/api/clients', { name: clientName, shortCode: `P${suffix.slice(-5).toUpperCase()}` })).client.id;
			const firstName = `Hungryroot ${suffix}`;
			const secondName = `Rank Group ${suffix}`;
			const firstId = (await post('/api/contracts', { clientId, name: firstName, isActive: true })).contract.id;
			const secondId = (await post('/api/contracts', { clientId, name: secondName, isActive: true })).contract.id;
			return { clientName, firstId, firstName, secondId, secondName };
		},
		{ suffix, label }
	);
}

const serverTimer = (page: Page) =>
	page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer as { id: string; contractId: string } | null);

/** The menu lies inside the viewport and its last item is what is drawn at its centre (not clipped) */
async function expectMenuWhollyOnScreen(page: Page) {
	const menuBox = (await contractMenu(page).boundingBox())!;
	const viewport = page.viewportSize()!;
	expect(menuBox.x).toBeGreaterThanOrEqual(0);
	expect(menuBox.y).toBeGreaterThanOrEqual(0);
	expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
	expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
	const lastItem = contractMenu(page).getByRole('menuitemradio').last();
	await lastItem.scrollIntoViewIfNeeded();
	const itemBox = (await lastItem.boundingBox())!;
	expect(itemBox.height).toBeGreaterThanOrEqual(44);
	const drawnOnTop = await page.evaluate(
		({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-testid="timer-contract-menu"]')),
		{ x: itemBox.x + itemBox.width / 2, y: itemBox.y + itemBox.height / 2 }
	);
	expect(drawnOnTop, 'the menu is drawn over everything at its last item').toBe(true);
}

const sidebarWidget = (page: Page) => page.getByTestId('timer-widget-sidebar');

async function expectNoContract(widget: Locator) {
	const identity = widget.getByTestId('timer-identity');
	await expect(identity.getByTestId('timer-identity-contract')).toHaveText('No contract yet');
	await expect(identity.getByTestId('contract-mark')).toHaveCount(0);
	await expect(identity.getByTestId('timer-select-contract')).toHaveText('Select');
}

test.describe('desktop sidebar', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('Select, cancel, choose, Change and collapse', async ({ page, baseURL }) => {
		await signInAsFreshUser(page, baseURL, 'timer-picker-desktop');
		const data = await seed(page, 'TP');
		await page.goto('/time');
		await page.waitForLoadState('networkidle');
		const widget = sidebarWidget(page);
		await widget.getByRole('button', { name: 'Start Timer' }).click();

		// No contract yet: no tile region, no running light, no contract field in the body
		await expectNoContract(widget);
		await expect(page.getByTestId('timer-running-dot')).toHaveCount(0);
		await expect(widget.getByRole('combobox')).toHaveCount(0);
		await expect(widget.getByText('No contract yet: pick one now')).toHaveCount(0);

		// Select opens the menu from the heading, wholly on screen beside the 240 px sidebar
		const trigger = widget.getByTestId('timer-select-contract');
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		await expect(contractMenu(page)).toBeVisible();
		await expectMenuWhollyOnScreen(page);
		const menuBox = (await contractMenu(page).boundingBox())!;
		const triggerBox = (await trigger.boundingBox())!;
		expect(menuBox.y, 'drops down from the trigger').toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);

		// An outside click closes it with nothing changed
		await page.getByTestId('timesheet-scroll').click({ position: { x: 400, y: 5 } });
		await expect(contractMenu(page)).toHaveCount(0);
		await expectNoContract(widget);
		expect(await serverTimer(page)).toBeNull();

		// Escape closes it with nothing changed; focus back on Select
		await trigger.click();
		await expect(contractMenu(page).getByRole('menuitemradio').first()).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(contractMenu(page)).toHaveCount(0);
		await expect(trigger).toBeFocused();
		await expectNoContract(widget);

		// Keyboard: End, Home, ArrowDown, then Enter chooses: the server draft and the tile appear
		await page.keyboard.press('Enter');
		await expect(contractMenu(page)).toBeVisible();
		const items = contractMenu(page).getByRole('menuitemradio');
		await page.keyboard.press('End');
		await expect(items.last()).toBeFocused();
		await page.keyboard.press('Home');
		await expect(items.first()).toBeFocused();
		const firstItemId = await items.first().getAttribute('data-contract-id');
		await page.keyboard.press('ArrowDown');
		const chosenId = await items.nth(1).getAttribute('data-contract-id');
		await page.keyboard.press('Enter');
		await expect(contractMenu(page)).toHaveCount(0);
		await expect.poll(async () => (await serverTimer(page))?.contractId ?? null).toBe(chosenId);
		const chosenName = chosenId === data.firstId ? data.firstName : data.secondName;
		const identity = widget.getByTestId('timer-identity');
		await expect(identity.getByTestId('timer-identity-contract')).toHaveText(chosenName);
		await expect(identity.getByTestId('timer-identity-client')).toHaveText(data.clientName);
		await expect(identity.getByTestId('contract-mark')).toBeVisible();
		const changeTrigger = widget.getByTestId('timer-change-contract');
		await expect(changeTrigger).toHaveText('Change');
		await expect(changeTrigger).toBeFocused();

		// Change: the current contract is checked; choosing another moves the same draft
		const draftId = (await serverTimer(page))!.id;
		await changeTrigger.click();
		await expect(contractMenu(page).getByRole('menuitemradio', { checked: true })).toHaveAttribute('data-contract-id', chosenId!);
		await expectMenuWhollyOnScreen(page);
		await contractMenu(page).locator(`[data-contract-id="${firstItemId}"]`).click();
		await expect.poll(async () => (await serverTimer(page))?.contractId ?? null).toBe(firstItemId);
		expect((await serverTimer(page))!.id).toBe(draftId);

		// Collapsing the widget closes the menu with nothing changed
		await changeTrigger.click();
		await expect(contractMenu(page)).toBeVisible();
		await widget.getByTestId('timer-collapse-toggle').click();
		await expect(contractMenu(page)).toHaveCount(0);
		await widget.getByTestId('timer-collapse-toggle').click();
		await expect(contractMenu(page)).toHaveCount(0);
		expect((await serverTimer(page))!.contractId).toBe(firstItemId);

		await widget.getByRole('button', { name: 'Stop', exact: true }).click();
		await widget.getByRole('button', { name: 'Discard', exact: true }).click();
		await expect(widget.getByRole('button', { name: 'Start Timer' })).toBeVisible();
	});
});

test('phone capture screen: the header picker, on screen, Escape closes only the menu @iphone', async ({ page, baseURL }, testInfo) => {
	test.skip(!testInfo.project.name.startsWith('iphone'), 'iPhone projects only');
	await signInAsFreshUser(page, baseURL, 'timer-picker-phone');
	const data = await seed(page, 'TQ');
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const homeWidget = page.locator('[data-testid^="timer-widget-"]').first();
	await homeWidget.getByRole('button', { name: 'Start Timer' }).click();
	await expectNoContract(homeWidget);

	// The capture screen (from the header pill on another screen) has the same header picker
	await page.goto('/time');
	await page.waitForLoadState('networkidle');
	await page.getByTestId('timer-indicator').click();
	const screen = page.getByTestId('phone-capture-screen');
	const screenWidget = page.getByTestId('timer-widget-screen');
	await expect(screen).toBeVisible();
	await expectNoContract(screenWidget);
	await expect(screenWidget.getByRole('combobox')).toHaveCount(0);
	await screenWidget.getByTestId('timer-select-contract').click();
	await expect(contractMenu(page)).toBeVisible();
	await expectMenuWhollyOnScreen(page);
	await page.keyboard.press('Escape');
	await expect(contractMenu(page)).toHaveCount(0);
	await expect(screen).toBeVisible();

	await screenWidget.getByTestId('timer-select-contract').click();
	await contractMenu(page).locator(`[data-contract-id="${data.secondId}"]`).click();
	await expect.poll(async () => (await serverTimer(page))?.contractId ?? null).toBe(data.secondId);
	await expect(screenWidget.getByTestId('timer-identity').getByTestId('contract-mark')).toBeVisible();
	await expect(screenWidget.getByTestId('timer-identity-contract')).toHaveText(data.secondName);
	await screenWidget.getByTestId('timer-change-contract').click();
	await expectMenuWhollyOnScreen(page);
	await contractMenu(page).locator(`[data-contract-id="${data.firstId}"]`).click();
	await expect.poll(async () => (await serverTimer(page))?.contractId ?? null).toBe(data.firstId);

	await screenWidget.getByRole('button', { name: 'Stop', exact: true }).click();
	await screenWidget.getByRole('button', { name: 'Discard', exact: true }).click();
});
