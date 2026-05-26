/**
 * Shared HTTP helpers used by FetchDataService.
 * Each helper checks response.ok and throws a descriptive error on failure.
 * Includes session-expiry detection: if a request returns 401 or 303 (auth redirect),
 * the user is redirected to the login page with a session-expired message.
 */

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
	const response = await fetch(url, options);

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
	return response.json() as Promise<ResponseType>;
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
