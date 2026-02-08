/**
 * Sync Fetcher — HTTP Transport Layer
 *
 * Handles the actual HTTP requests for the sync protocol: pulling
 * changes from the server and pushing local mutations. Separated
 * from the SyncEngine to keep each file focused and testable.
 *
 * The fetcher uses the standard Fetch API, which works on both
 * Tauri desktop and PWA/browser environments.
 */

import type {
	SyncPullResponse,
	SyncPushResponse,
	PendingMutation
} from './types';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class SyncAuthError extends Error {
	constructor(message: string = 'Authentication expired') {
		super(message);
		this.name = 'SyncAuthError';
	}
}

export class SyncNetworkError extends Error {
	constructor(message: string = 'Network request failed') {
		super(message);
		this.name = 'SyncNetworkError';
	}
}

export class SyncServerError extends Error {
	statusCode: number;
	constructor(statusCode: number, message: string) {
		super(message);
		this.name = 'SyncServerError';
		this.statusCode = statusCode;
	}
}

// ---------------------------------------------------------------------------
// Fetch function type (injectable for testing)
// ---------------------------------------------------------------------------

export type FetchFunction = typeof globalThis.fetch;

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/**
 * Fetch changes from the server since the given timestamp.
 *
 * @param sinceTimestamp - ISO timestamp; null means "fetch everything".
 * @param fetchFn - The fetch implementation (defaults to global fetch).
 * @returns The server's pull response with all changed rows.
 *
 * @throws SyncAuthError if the session has expired (401).
 * @throws SyncNetworkError on network failure.
 * @throws SyncServerError on non-OK server responses.
 */
export async function pullFromServer(
	sinceTimestamp: string | null,
	fetchFn: FetchFunction = globalThis.fetch
): Promise<SyncPullResponse> {
	const queryParams = sinceTimestamp ? `?since=${encodeURIComponent(sinceTimestamp)}` : '';
	const requestUrl = `/api/sync/pull${queryParams}`;

	let response: Response;
	try {
		response = await fetchFn(requestUrl, {
			method: 'GET',
			credentials: 'include',
			headers: { 'Accept': 'application/json' }
		});
	} catch (networkError) {
		throw new SyncNetworkError(
			networkError instanceof Error ? networkError.message : 'Network request failed'
		);
	}

	if (response.status === 401) {
		throw new SyncAuthError();
	}

	if (!response.ok) {
		const errorBody = await response.text().catch(() => 'Unknown error');
		throw new SyncServerError(response.status, errorBody);
	}

	return response.json() as Promise<SyncPullResponse>;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/**
 * Push local mutations to the server.
 *
 * @param mutations - The pending mutations to push.
 * @param fetchFn - The fetch implementation (defaults to global fetch).
 * @returns The server's push response with applied/conflict counts.
 *
 * @throws SyncAuthError if the session has expired (401).
 * @throws SyncNetworkError on network failure.
 * @throws SyncServerError on non-OK server responses.
 */
export async function pushToServer(
	mutations: PendingMutation[],
	fetchFn: FetchFunction = globalThis.fetch
): Promise<SyncPushResponse> {
	// Group mutations by table for the server API format
	const changesByTable: Record<string, { operation: 'upsert' | 'delete'; data: Record<string, unknown>; clientUpdatedAt?: string }[]> = {};

	for (const mutation of mutations) {
		if (!changesByTable[mutation.table]) {
			changesByTable[mutation.table] = [];
		}
		changesByTable[mutation.table].push({
			operation: mutation.operation,
			data: mutation.data,
			clientUpdatedAt: mutation.timestamp
		});
	}

	let response: Response;
	try {
		response = await fetchFn('/api/sync/push', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify({ changes: changesByTable })
		});
	} catch (networkError) {
		throw new SyncNetworkError(
			networkError instanceof Error ? networkError.message : 'Network request failed'
		);
	}

	if (response.status === 401) {
		throw new SyncAuthError();
	}

	if (!response.ok) {
		const errorBody = await response.text().catch(() => 'Unknown error');
		throw new SyncServerError(response.status, errorBody);
	}

	return response.json() as Promise<SyncPushResponse>;
}
