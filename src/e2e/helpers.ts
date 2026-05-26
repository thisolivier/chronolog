/**
 * E2E Test Helpers
 *
 * Shared utilities for end-to-end tests against the live Docker stack.
 * Provides base URL configuration, authenticated fetch wrapper, and test user management.
 */

/** Base URL for all API calls. Defaults to the Docker app server on IPv4. */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

/**
 * Origin header for Better Auth requests.
 * Better Auth validates Origin against its configured baseURL (http://localhost:5173).
 * We send that as the Origin even though the actual fetch goes to 127.0.0.1.
 */
export const AUTH_ORIGIN = process.env.BETTER_AUTH_URL || 'http://localhost:5173';

/** Test user credentials — unique per test run to avoid collisions */
const testRunId = Date.now().toString(36);
export const TEST_USER = {
	name: 'E2E Test User',
	email: `e2e-${testRunId}@test.chronolog.dev`,
	password: 'TestPassword123!'
};

/** Session cookies captured after authentication */
let sessionCookies: string[] = [];

/**
 * Register a new test user via Better Auth's signup endpoint.
 * Returns the session cookies set by the response.
 */
export async function signUpTestUser(): Promise<string[]> {
	const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Origin': AUTH_ORIGIN },
		body: JSON.stringify({
			name: TEST_USER.name,
			email: TEST_USER.email,
			password: TEST_USER.password
		}),
		redirect: 'manual'
	});

	if (!response.ok && response.status !== 302) {
		const body = await response.text().catch(() => 'unknown');
		throw new Error(`Sign-up failed (${response.status}): ${body}`);
	}

	const cookies = extractCookies(response);
	if (cookies.length === 0) {
		throw new Error('Sign-up succeeded but no session cookies were returned');
	}

	sessionCookies = cookies;
	return cookies;
}

/**
 * Sign in an existing test user via Better Auth's signin endpoint.
 * Returns the session cookies set by the response.
 */
export async function signInTestUser(): Promise<string[]> {
	const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Origin': AUTH_ORIGIN },
		body: JSON.stringify({
			email: TEST_USER.email,
			password: TEST_USER.password
		}),
		redirect: 'manual'
	});

	if (!response.ok && response.status !== 302) {
		const body = await response.text().catch(() => 'unknown');
		throw new Error(`Sign-in failed (${response.status}): ${body}`);
	}

	const cookies = extractCookies(response);
	if (cookies.length === 0) {
		throw new Error('Sign-in succeeded but no session cookies were returned');
	}

	sessionCookies = cookies;
	return cookies;
}

/**
 * Make an authenticated GET request to the API.
 */
export async function authGet(path: string): Promise<Response> {
	return fetch(`${BASE_URL}${path}`, {
		method: 'GET',
		headers: buildHeaders(),
		redirect: 'manual'
	});
}

/**
 * Make an authenticated POST request to the API.
 */
export async function authPost(path: string, body?: unknown): Promise<Response> {
	return fetch(`${BASE_URL}${path}`, {
		method: 'POST',
		headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
		body: body !== undefined ? JSON.stringify(body) : undefined,
		redirect: 'manual'
	});
}

/**
 * Make an authenticated PUT request to the API.
 */
export async function authPut(path: string, body?: unknown): Promise<Response> {
	return fetch(`${BASE_URL}${path}`, {
		method: 'PUT',
		headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
		body: body !== undefined ? JSON.stringify(body) : undefined,
		redirect: 'manual'
	});
}

/**
 * Make an authenticated DELETE request to the API.
 */
export async function authDelete(path: string, body?: unknown): Promise<Response> {
	const options: RequestInit = {
		method: 'DELETE',
		headers: buildHeaders(),
		redirect: 'manual'
	};

	if (body !== undefined) {
		(options.headers as Record<string, string>)['Content-Type'] = 'application/json';
		options.body = JSON.stringify(body);
	}

	return fetch(`${BASE_URL}${path}`, options);
}

/**
 * Set session cookies (used by setup to share auth state).
 */
export function setSessionCookies(cookies: string[]): void {
	sessionCookies = cookies;
}

/**
 * Get current session cookies.
 */
export function getSessionCookies(): string[] {
	return sessionCookies;
}

// -- Internal helpers --

function buildHeaders(): Record<string, string> {
	const headers: Record<string, string> = {};
	if (sessionCookies.length > 0) {
		headers['Cookie'] = sessionCookies.join('; ');
	}
	return headers;
}

function extractCookies(response: Response): string[] {
	const cookies: string[] = [];
	const setCookieHeaders = response.headers.getSetCookie?.() ?? [];

	for (const setCookie of setCookieHeaders) {
		// Extract just the cookie name=value part (before any attributes)
		const cookiePair = setCookie.split(';')[0].trim();
		if (cookiePair) {
			cookies.push(cookiePair);
		}
	}

	return cookies;
}
