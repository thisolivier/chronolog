/**
 * Playwright Offline Simulation Tests
 *
 * Uses browserContext.setOffline(true) to simulate network disconnection.
 * Tests the PWA offline handling:
 * - App doesn't crash when offline
 * - App navigation works while offline
 * - CRUD operations don't produce UI errors offline
 * - App reconnects when back online
 *
 * Known Issue: The ConnectionStatus Svelte 5 component's offline banner does not
 * render in Playwright's setOffline simulation. The $state mutation inside
 * the window 'offline' event listener is not triggering DOM re-render.
 * navigator.onLine correctly returns false, but the component's reactive state
 * does not update. This is documented as a bug to investigate separately.
 *
 * IMPORTANT: setOffline only works reliably in Chromium.
 */

import { test, expect } from '@playwright/test';

test.describe('Offline Simulation (Chromium only)', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'Offline simulation requires Chromium');

	/**
	 * Wait for the app to be fully loaded before going offline.
	 */
	async function waitForAppReady(page: import('@playwright/test').Page) {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });
		// Wait for initial data load + effect mount
		await page.waitForTimeout(2000);
	}

	test('app does not crash when going offline', async ({ page, context }) => {
		await waitForAppReady(page);

		// Go offline
		await context.setOffline(true);
		await page.waitForTimeout(1000);

		// The page should still be rendered — no blank screen
		const body = page.locator('body');
		await expect(body).toBeVisible();

		// The sidebar should still be functional
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
		await expect(page.getByTestId('sidebar-notes-heading')).toBeVisible();

		// Go back online
		await context.setOffline(false);
		await page.waitForTimeout(2000);
		await expect(body).toBeVisible();
	});

	test('navigation works while offline', async ({ page, context }) => {
		await waitForAppReady(page);

		// Go offline
		await context.setOffline(true);
		await page.waitForTimeout(500);

		// Navigate to notes mode — client-side navigation should work
		const generalContract = page.getByText('General').first();
		await expect(generalContract).toBeVisible();
		await generalContract.click();

		// The Notes heading should appear (client-side navigation, no server request needed)
		await expect(page.getByTestId('note-list-context')).toBeVisible({ timeout: 5000 });

		// Navigate back to time entries
		await page.getByRole('button', { name: 'Time Entries' }).click();
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();

		// Go back online
		await context.setOffline(false);
		await page.waitForTimeout(2000);
	});

	test('CRUD operations do not produce UI errors while offline', async ({ page, context }) => {
		page.on('dialog', async (dialog) => {
			await dialog.accept();
		});

		await waitForAppReady(page);

		// Navigate to notes
		await page.getByText('General').first().click();
		await expect(page.getByTestId('note-list-context')).toBeVisible({ timeout: 5000 });

		// Go offline
		await context.setOffline(true);
		await page.waitForTimeout(500);

		// Attempt to create a note while offline
		const newNoteButton = page.getByRole('button', { name: 'New Note' });
		await expect(newNoteButton).toBeVisible({ timeout: 5000 });
		await newNoteButton.click();
		await page.waitForTimeout(2000);

		// Check that no Vite error overlay appeared (uncaught errors show this)
		const errorOverlay = page.locator('vite-error-overlay');
		await expect(errorOverlay).not.toBeVisible({ timeout: 2000 });

		// The app should not have crashed
		const body = page.locator('body');
		await expect(body).toBeVisible();

		// Go back online
		await context.setOffline(false);
		await page.waitForTimeout(2000);
	});

	test('navigator.onLine reflects offline state correctly', async ({ page, context }) => {
		await waitForAppReady(page);

		// Verify initially online
		const onlineBefore = await page.evaluate(() => navigator.onLine);
		expect(onlineBefore).toBe(true);

		// Go offline
		await context.setOffline(true);
		await page.waitForTimeout(500);

		// Verify navigator.onLine is false
		const onlineAfter = await page.evaluate(() => navigator.onLine);
		expect(onlineAfter).toBe(false);

		// Go back online
		await context.setOffline(false);
		await page.waitForTimeout(500);

		// Verify navigator.onLine is true again
		const onlineRestored = await page.evaluate(() => navigator.onLine);
		expect(onlineRestored).toBe(true);
	});

	test('app recovers and loads data after reconnect', async ({ page, context }) => {
		await waitForAppReady(page);

		// Go offline briefly
		await context.setOffline(true);
		await page.waitForTimeout(2000);

		// Go back online
		await context.setOffline(false);

		// Reload to force fresh data fetch — proves the connection is restored
		await page.reload();
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });
		await expect(page.getByTestId('sidebar-notes-heading')).toBeVisible();

		// Data should load successfully
		const generalContract = page.getByText('General').first();
		await expect(generalContract).toBeVisible({ timeout: 10000 });
	});
});
