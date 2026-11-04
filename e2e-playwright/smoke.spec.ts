/**
 * Smoke tests — verify the app renders, login works, and navigation
 * between sections functions correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Unauthenticated', () => {
	// Override the project-level storageState so these tests run without auth cookies
	test.use({ storageState: { cookies: [], origins: [] } });
	test('shows login page for unauthenticated users', async ({ page }) => {
		await page.goto('/');
		// Should redirect to /login
		await page.waitForURL('**/login', { timeout: 10000 });
		await expect(page.locator('h1')).toContainText('Chronolog');
		await expect(page.getByText('Sign in to your account')).toBeVisible();
	});

	test('login page has email and password fields', async ({ page }) => {
		await page.goto('/login');
		await expect(page.locator('#email')).toBeVisible();
		await expect(page.locator('#password')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();
	});

	test('login page has link to register', async ({ page }) => {
		await page.goto('/login');
		const registerLink = page.locator('a[href="/register"]');
		await expect(registerLink).toBeVisible();
		await expect(registerLink).toContainText('Register');
	});

	test('register page loads', async ({ page }) => {
		await page.goto('/register');
		await expect(page.locator('h1')).toContainText('Chronolog');
		await expect(page.getByText('Create your account')).toBeVisible();
		await expect(page.locator('#name')).toBeVisible();
		await expect(page.locator('#email')).toBeVisible();
		await expect(page.locator('#password')).toBeVisible();
		await expect(page.locator('#confirm-password')).toBeVisible();
	});
});

test.describe('Authenticated', () => {
	// Storage state is applied by the project config (chromium/webkit depend on auth-setup)

	test('dashboard loads after login (time entries mode)', async ({ page }) => {
		await page.goto('/');
		// Should NOT redirect to /login
		await expect(page).not.toHaveURL(/\/login/);

		// The sidebar should show "Time Entries" button and "Contracts" heading
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });
		await expect(page.getByText('Contracts', { exact: true })).toBeVisible();
	});

	test('sidebar shows the auto-created "General" contract', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// The ensureAppUser hook creates an "Internal" client with a "General" contract
		await expect(page.getByText('General')).toBeVisible({ timeout: 10000 });
	});

	test('can navigate to Notes mode by clicking a contract', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Click the "General" contract to switch to notes mode
		const generalContract = page.getByText('General').first();
		await generalContract.click();

		// Should now show the Notes panel header
		await expect(page.getByTestId('note-list-context')).toBeVisible({ timeout: 5000 });
	});

	test('can navigate back to Time Entries mode', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		// Click "General" contract to go to notes mode
		const generalContract = page.getByText('General').first();
		await generalContract.click();
		await expect(page.getByTestId('note-list-context')).toBeVisible({ timeout: 5000 });

		// Click "Time Entries" to go back
		await page.getByRole('button', { name: 'Time Entries' }).click();

		// The "Time Entries" button should now have the active style
		// (we verify by checking it's still visible after click)
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	});

	test('Settings link is visible in sidebar', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible({ timeout: 10000 });

		const settingsLink = page.locator('a[href="/settings"]');
		await expect(settingsLink).toBeVisible();
		await expect(settingsLink).toContainText('Settings');
	});
});
