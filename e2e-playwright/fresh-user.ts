/**
 * Sign the page's browser context in as a brand-new user (044-CL). For tests that change state
 * shared by the whole user, such as the client order: the shared Playwright user is used by every
 * spec in both browsers at once, so two reorder tests running together would overwrite each other's
 * order. Signing up replaces the context's session cookie; the dev server must allow registration.
 */
import { expect, type Page } from '@playwright/test';

export async function signInAsFreshUser(page: Page, baseURL: string | undefined, label: string): Promise<string> {
	// Better Auth checks Origin against BETTER_AUTH_URL, which is the dev server's own URL
	const origin = new URL(baseURL ?? 'http://localhost:5173').origin;
	const email = `${process.env.E2E_USER_PREFIX ?? 'pw-test'}-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@chronolog.test`;
	const response = await page.request.post('/api/auth/sign-up/email', {
		headers: { Origin: origin },
		data: { name: `Fresh ${label}`, email, password: 'FreshUser044!pass' }
	});
	expect(response.ok(), await response.text()).toBe(true);
	return email;
}
