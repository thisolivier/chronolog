/**
 * Choosing the running timer's contract from its identity header (sprint 064-DR, T4): the
 * "Select" (no contract yet) or "Change" link opens a menu of contracts; an item is a
 * `menuitemradio` named "Client / Contract" and carrying `data-contract-id`.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** The header's picker trigger in a timer widget, whichever it reads */
export function contractPickerTrigger(widget: Locator): Locator {
	return widget.locator('[data-testid="timer-select-contract"], [data-testid="timer-change-contract"]');
}

export function contractMenu(page: Page): Locator {
	return page.getByTestId('timer-contract-menu');
}

/** Open the picker in `widget` and choose a contract by id or by its "Client / Contract" label */
export async function chooseTimerContract(page: Page, widget: Locator, contract: { id: string } | { label: string }): Promise<void> {
	await contractPickerTrigger(widget).click();
	const menu = contractMenu(page);
	await expect(menu).toBeVisible();
	const item =
		'id' in contract
			? menu.locator(`[role="menuitemradio"][data-contract-id="${contract.id}"]`)
			: menu.getByRole('menuitemradio', { name: contract.label, exact: true });
	await item.click();
	await expect(menu).toHaveCount(0);
}
