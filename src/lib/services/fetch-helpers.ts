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
 * (with the offline banner saying so) instead of "No entries". Writes are never cached or queued,
 * but a successful write updates or evicts the cached reads of the resource it changed.
 */
const lastLoadedResponses = new Map<string, unknown>();

/** The URL's path without query string or hash, e.g. `/api/notes?contractId=x` → `/api/notes`. */
function resourcePath(url: string): string {
	return url.split(/[?#]/)[0].replace(/\/+$/, '');
}

function hasSameTopLevelKeys(first: unknown, second: unknown): boolean {
	if (!first || !second || typeof first !== 'object' || typeof second !== 'object') return false;
	const firstKeys = Object.keys(first).sort().join(',');
	return firstKeys !== '' && firstKeys === Object.keys(second).sort().join(',');
}

/**
 * Keep the read cache in step with a successful write, so an offline read never serves a copy
 * older than the last save (QA 2, R2). Cached GETs of the written path (any query string) are
 * replaced by a PUT/PATCH response shaped like them (e.g. `{ note }`), or evicted otherwise;
 * a DELETE also evicts the resource's sub-resources (`/api/notes/B/backlinks`). Other paths,
 * including the parent collection (`/api/notes?contractId=…`), keep working offline.
 */
function updateReadCacheAfterWrite(url: string, method: string, responseBody: unknown): void {
	const writtenPath = resourcePath(url);
	for (const [cachedUrl, cachedBody] of [...lastLoadedResponses]) {
		const cachedPath = resourcePath(cachedUrl);
		const isWrittenResource = cachedPath === writtenPath;
		const isDeletedSubResource = method === 'DELETE' && cachedPath.startsWith(`${writtenPath}/`);
		if (!isWrittenResource && !isDeletedSubResource) continue;
		const canWriteThrough =
			cachedUrl === url &&
			(method === 'PUT' || method === 'PATCH') &&
			hasSameTopLevelKeys(cachedBody, responseBody);
		if (canWriteThrough) lastLoadedResponses.set(cachedUrl, responseBody);
		else lastLoadedResponses.delete(cachedUrl);
	}
}

/** Clear the offline read cache — used in tests only. */
export function _resetLastLoadedResponses(): void {
	lastLoadedResponses.clear();
}

/** A non-OK HTTP response; `status` lets callers react to specific codes (e.g. 409). */
export class HttpError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'HttpError';
	}
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
	const method = (options?.method ?? 'GET').toUpperCase();
	const isRead = method === 'GET';
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
		throw new HttpError(
			`${options?.method ?? 'GET'} ${url} failed (${response.status}): ${errorText}`,
			response.status
		);
	}
	const body = (await response.json()) as ResponseType;
	if (isRead) lastLoadedResponses.set(url, body);
	else updateReadCacheAfterWrite(url, method, body);
	return body;
}

/** The browser's IANA timezone; the server dates new note IDs with it (sprint 029-CL). */
function browserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return '';
	}
}

export async function postJson<ResponseType>(url: string, body: unknown): Promise<ResponseType> {
	const timezone = browserTimezone();
	return fetchJson<ResponseType>(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(timezone ? { 'X-Timezone': timezone } : {}) },
		body: JSON.stringify(body)
	});
}

/** PATCH with the browser's timezone, which the timer start check reads as "now" (sprint 041-CL). */
export async function patchJson<ResponseType>(url: string, body: unknown): Promise<ResponseType> {
	const timezone = browserTimezone();
	return fetchJson<ResponseType>(url, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', ...(timezone ? { 'X-Timezone': timezone } : {}) },
		body: JSON.stringify(body)
	});
}

export async function putJson<ResponseType>(
	url: string,
	body: unknown,
	extraOptions?: Pick<RequestInit, 'keepalive'>
): Promise<ResponseType> {
	return fetchJson<ResponseType>(url, {
		...extraOptions,
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
