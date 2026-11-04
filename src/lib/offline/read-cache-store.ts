/**
 * The long-lived read cache (sprint 045-CL): the last server copy of every GET the app made, in
 * IndexedDB, one database per user (`chronolog-reads-<userId>`), so a reload while offline still
 * shows the notes, lists, sidebar and weeks already visited. Signing out deletes every one.
 *
 * Plain IndexedDB, no wrapper library: three operations (load all, put, delete) do not need one.
 */
import type { ReadCachePersistence } from '$lib/services/fetch-helpers';

const DATABASE_PREFIX = 'chronolog-reads-';
const STORE_NAME = 'reads';
/** Oldest copies beyond this are dropped when the cache is loaded */
const MAX_CACHED_READS = 600;

type StoredRead = { url: string; body: unknown; savedAt: number };

function requestResult<Result>(request: IDBRequest<Result>): Promise<Result> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function openDatabase(name: string): Promise<IDBDatabase> {
	const request = indexedDB.open(name, 1);
	request.onupgradeneeded = () => {
		if (!request.result.objectStoreNames.contains(STORE_NAME)) {
			request.result.createObjectStore(STORE_NAME, { keyPath: 'url' });
		}
	};
	return requestResult(request);
}

export type OpenedReadCache = {
	persistence: ReadCachePersistence;
	/** Stored copies, oldest first */
	entries: [string, unknown][];
	close(): void;
};

export async function openReadCache(userId: string): Promise<OpenedReadCache | null> {
	if (typeof indexedDB === 'undefined') return null;
	const database = await openDatabase(`${DATABASE_PREFIX}${userId}`);
	const stored = (await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).getAll())) as StoredRead[];
	stored.sort((first, second) => first.savedAt - second.savedAt);
	const excess = stored.length - MAX_CACHED_READS;
	if (excess > 0) {
		const store = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
		for (const old of stored.splice(0, excess)) store.delete(old.url);
	}

	// Writes are fire-and-forget: a failed cache write only means a less complete offline view
	const write = (operation: (store: IDBObjectStore) => void) => {
		try {
			operation(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME));
		} catch (writeError) {
			console.warn('[offline] read cache write failed', writeError);
		}
	};
	return {
		entries: stored.map((read) => [read.url, read.body]),
		persistence: {
			put: (url, body) => write((store) => store.put({ url, body, savedAt: Date.now() } satisfies StoredRead)),
			remove: (url) => write((store) => store.delete(url))
		},
		close: () => database.close()
	};
}

/** Delete every user's read cache in this browser (sign-out). */
export async function deleteAllReadCaches(): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	const names = typeof indexedDB.databases === 'function'
		? (await indexedDB.databases()).map((info) => info.name ?? '').filter((name) => name.startsWith(DATABASE_PREFIX))
		: [];
	await Promise.all(
		names.map(
			(name) =>
				new Promise<void>((resolve) => {
					const request = indexedDB.deleteDatabase(name);
					request.onsuccess = request.onerror = request.onblocked = () => resolve();
				})
		)
	);
}
