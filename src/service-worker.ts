/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * The app shell for offline reloads (sprint 045-CL). SvelteKit builds and registers this file.
 *
 * - The built app (JS, CSS) and static files are cached at install, per version.
 * - Pages: network first; a signed-in page that loaded is kept, and offline a reload gets the same
 *   URL's last copy, else the last page that loaded (the workspace routes share one layout and
 *   read the URL themselves). Sign-in pages and redirects are never kept. Sign-out deletes them.
 * - `/api/*` is never touched here: the app's own read cache and outbox handle data, and a
 *   failed request is how the app knows it is offline.
 * - Anything else on this origin (Vite's modules in development) is network first with a copy,
 *   except SvelteKit's `__data.json` (it carries the signed-in user).
 * - A new version keeps the kept pages and the previous version's files, so the first offline
 *   start after a deploy still loads the old page with its old files (review fix 3); older
 *   versions go.
 *
 * A new version waits until the page's "Update" asks it to take over (`SKIP_WAITING`).
 */
import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

const SHELL_CACHE = `chronolog-shell-${version}`;
const PAGE_CACHE = 'chronolog-pages';
const RUNTIME_CACHE = 'chronolog-runtime';
const LAST_PAGE_KEY = '/__chronolog-last-page__';
const PRECACHED = new Set([...build, ...files]);
const NEVER_KEPT_PAGES = ['/login', '/register', '/unlock'];
/** Caches from the earlier generated (workbox) worker, which never worked with server rendering */
const LEGACY_CACHE_PREFIXES = ['workbox-precache', 'api-cache', 'static-assets-cache'];

worker.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll([...PRECACHED])));
});

/** Shell caches by version, newest first (SvelteKit's version is a build timestamp by default) */
function shellCachesNewestFirst(names: string[]): string[] {
	return names
		.filter((name) => name.startsWith('chronolog-shell-'))
		.sort((first, second) => second.localeCompare(first, undefined, { numeric: true }));
}

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			// Keep this version and the one before it: kept pages may still name its files
			const keptShells = new Set([SHELL_CACHE, ...shellCachesNewestFirst(names).filter((name) => name !== SHELL_CACHE).slice(0, 1)]);
			for (const name of names) {
				const oldShell = name.startsWith('chronolog-shell-') && !keptShells.has(name);
				const legacy = LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));
				if (oldShell || legacy) await caches.delete(name);
			}
			await worker.clients.claim();
		})()
	);
});

worker.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void worker.skipWaiting();
});

function isKeptPage(url: URL, response: Response): boolean {
	return (
		response.ok &&
		response.type === 'basic' &&
		!response.redirected &&
		(response.headers.get('content-type') ?? '').includes('text/html') &&
		!NEVER_KEPT_PAGES.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))
	);
}

async function handleNavigation(request: Request, url: URL): Promise<Response> {
	try {
		const response = await fetch(request);
		if (isKeptPage(url, response)) {
			const cache = await caches.open(PAGE_CACHE);
			await cache.put(url.pathname, response.clone());
			await cache.put(LAST_PAGE_KEY, response.clone());
		}
		return response;
	} catch (networkError) {
		const cache = await caches.open(PAGE_CACHE);
		const kept = (await cache.match(url.pathname)) ?? (await cache.match(LAST_PAGE_KEY));
		if (kept) return kept;
		throw networkError;
	}
}

async function handleAsset(request: Request, url: URL): Promise<Response> {
	if (PRECACHED.has(url.pathname)) {
		const cached = await caches.match(url.pathname, { cacheName: SHELL_CACHE });
		if (cached) return cached;
	}
	// A previous version's file, named by a kept page: never changes, so any cached copy will do
	if (url.pathname.startsWith('/_app/immutable/')) {
		const cached = await caches.match(url.pathname);
		if (cached) return cached;
	}
	try {
		const response = await fetch(request);
		if (response.ok && response.type === 'basic' && !url.pathname.endsWith('__data.json')) {
			const cache = await caches.open(RUNTIME_CACHE);
			await cache.put(request, response.clone());
		}
		return response;
	} catch (networkError) {
		const cached = await caches.match(request, { cacheName: RUNTIME_CACHE });
		if (cached) return cached;
		throw networkError;
	}
}

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== worker.location.origin) return;
	if (url.pathname.startsWith('/api/') || url.pathname === '/_app/version.json') return;
	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request, url));
	} else {
		event.respondWith(handleAsset(request, url));
	}
});
