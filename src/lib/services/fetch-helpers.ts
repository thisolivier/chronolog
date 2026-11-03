/**
 * Shared HTTP helpers used by FetchDataService.
 * Each helper checks response.ok and throws a descriptive error on failure.
 * Includes session-expiry detection: if a request returns 401 or 303 (auth redirect),
 * the user is redirected to the login page with a session-expired message.
 */

import { connectivity } from '$lib/stores/connectivity.svelte';

/**
 * Last successful JSON body per GET URL. When the network is down, a GET that was loaded before
 * returns this copy instead of failing, so the timesheet keeps showing the last loaded week
 * (with the offline banner saying so) instead of "No entries". Writes are never cached or queued.
 */
const lastLoadedResponses = new Map<string, unknown>();

/** Clear the offline read cache — used in tests only. */
export function _resetLastLoadedResponses(): void {
	lastLoadedResponses.clear();
}

/** Event dispatched when a session expiry is detected on reconnect */
export class SessionExpiredError extends Error {
	constructor(statusCode: number, url: string) {
		super(`Session expired (${statusCode}) during ${url}`);
		this.name = 'SessionExpiredError';
	}
}

/**
 * Redirects to login when session has expired.
 * Preserves the current path so the user can return after re-login.
 * Only triggers once to avoid redirect loops.
 */
let sessionExpiredRedirectInProgress = false;

function handleSessionExpired(): void {
	if (sessionExpiredRedirectInProgress) return;
	if (typeof window === 'undefined') return;

	sessionExpiredRedirectInProgress = true;
	const currentPath = window.location.pathname;
	window.location.href = `/login?expired=1&redirect=${encodeURIComponent(currentPath)}`;
}

/** Reset the redirect guard — used in tests only. */
export function _resetSessionExpiredState(): void {
	sessionExpiredRedirectInProgress = false;
}

export async function fetchJson<ResponseType>(
	url: string,
	options?: RequestInit
): Promise<ResponseType> {
	const isRead = (options?.method ?? 'GET').toUpperCase() === 'GET';
	let response: Response;
	try {
		response = await fetch(url, options);
	} catch (networkError) {
		// fetch() only rejects when the request never got a response: offline or server down
		if (networkError instanceof Error && networkError.name === 'AbortError') throw networkError;
		connectivity.reportNetworkFailure();
		if (isRead && lastLoadedResponses.has(url)) {
			return lastLoadedResponses.get(url) as ResponseType;
		}
		throw networkError;
	}
	connectivity.reportNetworkSuccess();

	// Detect session expiry: 401 Unauthorized or 303 redirect to login
	if (response.status === 401 || (response.status === 303 && response.headers.get('location')?.includes('/login'))) {
		handleSessionExpired();
		throw new SessionExpiredError(response.status, url);
	}

	if (!response.ok) {
		const errorText = await response.text().catch(() => 'Unknown error');
		throw new Error(
			`${options?.method ?? 'GET'} ${url} failed (${response.status}): ${errorText}`
		);
	}
	const body = (await response.json()) as ResponseType;
	if (isRead) lastLoadedResponses.set(url, body);
	return body;
}

export async function postJson<ResponseType>(url: string, body: unknown): Promise<ResponseType> {
	return fetchJson<ResponseType>(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export async function putJson<ResponseType>(url: string, body: unknown): Promise<ResponseType> {
	return fetchJson<ResponseType>(url, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export async function deleteRequest<ResponseType = void>(
	url: string,
	body?: unknown
): Promise<ResponseType> {
	const options: RequestInit = { method: 'DELETE' };
	if (body !== undefined) {
		options.headers = { 'Content-Type': 'application/json' };
		options.body = JSON.stringify(body);
	}
	return fetchJson<ResponseType>(url, options);
}
