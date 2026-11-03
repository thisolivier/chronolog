/**
 * Playwright auth setup — registers a test user (if needed) and saves
 * authenticated browser storage state for reuse across all test files.
 *
 * The storage state file is written to `e2e-playwright/.auth/user.json`.
 * Other test files import it via `storageState` in their `use` config.
 *
 * Requires the dev server to run with ALLOW_REGISTRATION=true (set in
 * playwright.config.ts webServer.env; a reused server must set it itself).
 */

import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

/** Test user credentials — unique per Playwright run to avoid collisions */
const TEST_USER_NAME = 'Playwright Tester';
const TEST_USER_EMAIL = `pw-test-${Date.now()}@chronolog.test`;
const TEST_USER_PASSWORD = 'TestPassword123!';

export const STORAGE_STATE_PATH = path.join(
	currentDirectory,
	'.auth',
	'user.json'
);

/**
 * Shared credentials for import by other test files that need them
 * (e.g. to verify the logged-in user name is shown).
 */
export const TEST_CREDENTIALS = {
	name: TEST_USER_NAME,
	email: TEST_USER_EMAIL,
	password: TEST_USER_PASSWORD
};

setup('register and authenticate test user', async ({ page }) => {
	// Step 1: Register a new user via the registration page
	await page.goto('/register');
	// Wait for hydration: before it, the form submits natively (GET /register?) and is lost
	await page.waitForLoadState('networkidle');
	await expect(page.locator('h1')).toContainText('Chronolog');

	await page.locator('#name').fill(TEST_USER_NAME);
	await page.locator('#email').fill(TEST_USER_EMAIL);
	await page.locator('#password').fill(TEST_USER_PASSWORD);
	await page.locator('#confirm-password').fill(TEST_USER_PASSWORD);

	await page.locator('button[type="submit"]').click();

	// Better Auth signs the new user in, so registration ends on `/` (via a brief stop
	// at /login, which redirects signed-in users). Older builds stayed on /login.
	const landedOnRoot = await page
		.waitForURL((url) => url.pathname === '/', { timeout: 15000 })
		.then(() => true)
		.catch(() => false);
	if (!landedOnRoot) {
		await page.locator('#email').fill(TEST_USER_EMAIL);
		await page.locator('#password').fill(TEST_USER_PASSWORD);
		await page.locator('button[type="submit"]').click();
		await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
	}

	// Verify we see the authenticated app shell (sidebar has "Time Entries" button)
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

	// Save storage state for reuse by other tests
	await page.context().storageState({ path: STORAGE_STATE_PATH });
});
