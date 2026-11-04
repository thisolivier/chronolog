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
 * (with the offline banner saying so) instead of "No entries". A successful write updates or
 * evicts the cached reads of the resource it changed. Writes made offline are queued one level up,
 * by the outbox (`$lib/offline`, sprint 045-CL), never here.
 */
const lastLoadedResponses = new Map<string, unknown>();

/**
 * Where the read cache is kept between page loads (sprint 045-CL: IndexedDB per user, see
 * `$lib/offline/read-cache-store.ts`). Without one the cache lives for the page session only.
 */
export interface ReadCachePersistence {
	put(url: string, body: unknown): void;
	remove(url: string): void;
}

let readCachePersistence: ReadCachePersistence | null = null;
/** Settles once the stored copies are loaded; a read that fails before then waits for it */
let readCacheLoading: Promise<unknown> | null = null;

export function setReadCachePersistence(persistence: ReadCachePersistence | null): void {
	readCachePersistence = persistence;
}

export function setReadCacheLoading(loading: Promise<unknown> | null): void {
	readCacheLoading = loading;
}

/** The cached copy for a failed read, after the stored copies have loaded */
async function cachedReadAfterFailure(url: string): Promise<{ found: boolean; body?: unknown }> {
	if (!lastLoadedResponses.has(url) && readCacheLoading) await readCacheLoading.catch(() => {});
	return lastLoadedResponses.has(url) ? { found: true, body: lastLoadedResponses.get(url) } : { found: false };
}

/** Fill the cache from storage; never replaces a copy this page already loaded. */
export function hydrateReadCache(entries: Iterable<[string, unknown]>): void {
	for (const [url, body] of entries) {
		if (!lastLoadedResponses.has(url)) lastLoadedResponses.set(url, body);
	}
}

function rememberRead(url: string, body: unknown): void {
	// Delete first so the map stays in load order (newest last)
	lastLoadedResponses.delete(url);
	lastLoadedResponses.set(url, body);
	readCachePersistence?.put(url, body);
}

function forgetRead(url: string): void {
	lastLoadedResponses.delete(url);
	readCachePersistence?.remove(url);
}

/** The cached server copy for a GET URL, if any (the outbox reads the base of an edit here). */
export function peekCachedRead<ResponseType>(url: string): ResponseType | undefined {
	return lastLoadedResponses.get(url) as ResponseType | undefined;
}

/** Every cached GET whose URL starts with `prefix`, newest first. */
export function cachedReadsStartingWith(prefix: string): [string, unknown][] {
	return [...lastLoadedResponses].filter(([url]) => url.startsWith(prefix)).reverse();
}

/** Forget every cached read (sign-out). */
export function clearReadCache(): void {
	lastLoadedResponses.clear();
}

/**
 * Answers that mean the server is not reachable behind the proxy (Cloudflare 502/503/504 and
 * 52x while the Mac mini is down). Treated like a network failure: reads use the cache and
 * writes go to the outbox.
 */
export function isGatewayStatus(status: number): boolean {
	return status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 530);
}

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
		if (canWriteThrough) rememberRead(cachedUrl, responseBody);
		else forgetRead(cachedUrl);
	}
}

/** Clear the offline read cache — used in tests only. */
export function _resetLastLoadedResponses(): void {
	lastLoadedResponses.clear();
	readCachePersistence = null;
	readCacheLoading = null;
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
	options?: RequestInit,
	{ offlineFallback = true, onStatus }: { offlineFallback?: boolean; onStatus?: (status: number) => void } = {}
): Promise<ResponseType> {
	const method = (options?.method ?? 'GET').toUpperCase();
	const isRead = method === 'GET';
	const canUseCache = isRead && offlineFallback;
	let response: Response;
	try {
		response = await fetch(url, options);
	} catch (networkError) {
		// fetch() only rejects when the request never got a response: offline or server down
		if (networkError instanceof Error && networkError.name === 'AbortError') throw networkError;
		connectivity.reportNetworkFailure();
		const cached = canUseCache ? await cachedReadAfterFailure(url) : { found: false };
		if (cached.found) return cached.body as ResponseType;
		throw networkError;
	}
	if (isGatewayStatus(response.status)) {
		connectivity.reportNetworkFailure();
		const cached = canUseCache ? await cachedReadAfterFailure(url) : { found: false };
		if (cached.found) return cached.body as ResponseType;
		throw new HttpError(`${method} ${url} failed (${response.status}): server unreachable`, response.status);
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
	onStatus?.(response.status);
	if (isRead) rememberRead(url, body);
	else updateReadCacheAfterWrite(url, method, body);
	return body;
}

/** A GET that never answers from the cache: the outbox compares against the live server copy. */
export function fetchFreshJson<ResponseType>(url: string): Promise<ResponseType> {
	return fetchJson<ResponseType>(url, undefined, { offlineFallback: false });
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

/** A POST that also says how it succeeded: 201 made the row, 200 found it (idempotent creates) */
export async function postJsonWithStatus<ResponseType>(url: string, body: unknown): Promise<{ body: ResponseType; status: number }> {
	const timezone = browserTimezone();
	let status = 0;
	const responseBody = await fetchJson<ResponseType>(
		url,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(timezone ? { 'X-Timezone': timezone } : {}) },
			body: JSON.stringify(body)
		},
		{ onStatus: (responseStatus) => (status = responseStatus) }
	);
	return { body: responseBody, status };
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
