/**
 * E2E Global Setup
 *
 * Vitest globalSetup that registers a test user and writes the session
 * cookies to a temp file for test files to read. Runs once before all e2e tests.
 *
 * Registration is closed by default: the target stack must run with
 * ALLOW_REGISTRATION=true or the sign-up below is refused by Better Auth.
 */

import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

/** Better Auth validates Origin against its configured baseURL (http://localhost:5173). */
const AUTH_ORIGIN = process.env.BETTER_AUTH_URL || 'http://localhost:5173';

/** Test user credentials — unique per test run to avoid collisions */
const testRunId = Date.now().toString(36);
const TEST_USER = {
	name: 'E2E Test User',
	email: `e2e-${testRunId}@test.chronolog.dev`,
	password: 'TestPassword123!'
};

/** Path to the temp file storing session state */
export const SESSION_FILE = join(import.meta.dirname, '.e2e-session.json');

/**
 * Register the test user and trigger the ensureAppUser() flow.
 * The first authenticated request auto-creates the user record,
 * "Internal" client, and "General" contract.
 */
export async function setup(): Promise<void> {
	console.log(`\n[E2E Setup] Registering test user: ${TEST_USER.email}`);
	console.log(`[E2E Setup] Base URL: ${BASE_URL}`);

	// Step 1: Sign up
	const signUpResponse = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Origin': AUTH_ORIGIN
		},
		body: JSON.stringify({
			name: TEST_USER.name,
			email: TEST_USER.email,
			password: TEST_USER.password
		}),
		redirect: 'manual'
	});

	if (!signUpResponse.ok && signUpResponse.status !== 302) {
		const body = await signUpResponse.text().catch(() => 'unknown');
		throw new Error(`[E2E Setup] Sign-up failed (${signUpResponse.status}): ${body}`);
	}

	const cookies = signUpResponse.headers.getSetCookie?.() ?? [];
	const sessionCookies = cookies
		.map((cookieStr) => cookieStr.split(';')[0].trim())
		.filter(Boolean);

	if (sessionCookies.length === 0) {
		throw new Error('[E2E Setup] No session cookies received after sign-up');
	}

	console.log(`[E2E Setup] Sign-up successful, got ${sessionCookies.length} cookie(s)`);

	// Step 2: Trigger ensureAppUser by making an authenticated request.
	// GET /api/clients will go through hooks.server.ts which calls ensureAppUser().
	const clientsResponse = await fetch(`${BASE_URL}/api/clients`, {
		headers: { Cookie: sessionCookies.join('; ') },
		redirect: 'manual'
	});

	if (!clientsResponse.ok) {
		const body = await clientsResponse.text().catch(() => 'unknown');
		throw new Error(
			`[E2E Setup] Initial authenticated request failed (${clientsResponse.status}): ${body}`
		);
	}

	console.log('[E2E Setup] User setup complete (ensureAppUser triggered)');

	// Write session data to a file so test workers can read it
	const sessionData = {
		cookies: sessionCookies,
		testUser: TEST_USER,
		baseUrl: BASE_URL
	};
	writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
	console.log(`[E2E Setup] Session data written to ${SESSION_FILE}`);
}

export async function teardown(): Promise<void> {
	// Clean up the session file
	if (existsSync(SESSION_FILE)) {
		unlinkSync(SESSION_FILE);
		console.log('[E2E Teardown] Session file cleaned up');
	}
	console.log('[E2E Teardown] Test run complete');
}
