/**
 * Sprint 044-CL: the two-factor sign-in path end to end (it was broken from sprint 003 to
 * 2026-11-04 without any test noticing). A fresh `qa-044-*` user registers (registration ends in
 * the app through a client-side move from /register via /login, which must not throw
 * "Navigation context not found"), enables TOTP in Settings with a code computed here from the
 * secret in the otpauth URI, signs out, signs in with the password and a fresh code, and lands in
 * the app. TOTP is RFC 6238 (HMAC-SHA1, 30 s, 6 digits) with `node:crypto`; no dependency.
 */
import { test, expect, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { sprintScreenshotDirectory } from './sprint-screenshots';

test.use({ storageState: { cookies: [], origins: [] } });

const SCREENSHOTS = sprintScreenshotDirectory('sprint-044');
const PASSWORD = 'TwoFactor044!pass';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(encoded: string): Buffer {
	let bits = '';
	for (const character of encoded.replace(/=+$/, '').toUpperCase()) {
		const value = BASE32_ALPHABET.indexOf(character);
		if (value === -1) throw new Error(`not base32: ${character}`);
		bits += value.toString(2).padStart(5, '0');
	}
	const bytes: number[] = [];
	for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
	return Buffer.from(bytes);
}

/** RFC 6238 TOTP for a time step (RFC 4226 dynamic truncation) */
export function totpCode(base32Secret: string, timeStep: number, digits = 6): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(timeStep));
	const digest = createHmac('sha1', decodeBase32(base32Secret)).update(counter).digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const binary = digest.readUInt32BE(offset) & 0x7fffffff;
	return String(binary % 10 ** digits).padStart(digits, '0');
}

const currentTimeStep = () => Math.floor(Date.now() / 1000 / 30);

/** Wait (at most one 30 s window) until the time step differs from `usedStep`, so a code is never reused */
async function nextUnusedTimeStep(page: Page, usedStep: number): Promise<number> {
	await expect.poll(currentTimeStep, { timeout: 35_000, intervals: [500] }).toBeGreaterThan(usedStep);
	return currentTimeStep();
}

test('RFC 6238 test vector (SHA-1, 8 digits)', () => {
	// Secret "12345678901234567890" in base32; T = 59 s -> step 1 -> 94287082
	expect(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1, 8)).toBe('94287082');
	expect(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', Math.floor(1111111109 / 30), 8)).toBe('07081804');
});

test('register, enable TOTP, sign out, sign in with a code, land in the app', async ({ page, browserName }) => {
	test.setTimeout(90_000);
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	const email = `${process.env.E2E_USER_PREFIX ?? 'qa-044-pw'}-2fa-${browserName}-${Date.now().toString(36)}@chronolog.test`;

	// Register: Better Auth signs the new user in; /login sends a signed-in user on to the app
	// with a client-side redirect, so the root layout already holds the navigation context
	await page.goto('/register');
	await page.waitForLoadState('networkidle');
	await page.locator('#name').fill('QA 044 Two Factor');
	await page.locator('#email').fill(email);
	await page.locator('#password').fill(PASSWORD);
	await page.locator('#confirm-password').fill(PASSWORD);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	await page.waitForLoadState('networkidle');

	// Enable TOTP with a code computed from the URI's secret
	await page.goto('/settings/two-factor');
	await page.waitForLoadState('networkidle');
	await page.locator('#current-password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Enable 2FA' }).click();
	await page.getByText('Cannot scan? Enter the URI manually').click();
	const totpUri = (await page.locator('details code').textContent())?.trim() ?? '';
	expect(totpUri).toMatch(/^otpauth:\/\/totp\//);
	const secret = new URL(totpUri).searchParams.get('secret') ?? '';
	expect(secret).not.toBe('');
	const enrolmentStep = currentTimeStep();
	await page.locator('#verification-code').fill(totpCode(secret, enrolmentStep));
	await page.getByRole('button', { name: 'Verify & Enable' }).click();
	await expect(page.getByText('Two-factor authentication has been enabled.')).toBeVisible();

	// Sign out from Settings
	await page.goto('/settings');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await page.waitForURL((url) => url.pathname === '/login');
	await page.waitForLoadState('networkidle');

	// Password first: the server answers with a 2FA challenge, no session yet
	await page.locator('#email').fill(email);
	await page.locator('#password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.locator('#totp-code')).toBeVisible();
	await expect(page.getByText('Enter your 2FA code')).toBeVisible();
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '01-two-factor-code-prompt.png') });

	// A wrong code is refused and keeps the form
	const signInStep = await nextUnusedTimeStep(page, enrolmentStep);
	const goodCode = totpCode(secret, signInStep);
	const wrongCode = String((Number(goodCode) + 500_000) % 1_000_000).padStart(6, '0');
	await page.locator('#totp-code').fill(wrongCode);
	await page.getByRole('button', { name: 'Verify' }).click();
	await expect(page.locator('.bg-red-50')).toBeVisible();
	await expect(page).toHaveURL(/\/login$/);

	// The right code signs in and lands in the app
	await page.locator('#totp-code').fill(totpCode(secret, currentTimeStep()));
	await page.getByRole('button', { name: 'Verify' }).click();
	await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	const me = await page.evaluate(async () => (await fetch('/api/me')).json());
	expect(me.user.email).toBe(email);
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '02-signed-in-after-2fa.png') });

	expect(pageErrors.filter((message) => /Navigation context/.test(message))).toEqual([]);
});
