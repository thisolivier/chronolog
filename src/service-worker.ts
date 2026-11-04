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
 * - Anything else on this origin (Vite's modules in development) is network first with a copy.
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

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const name of await caches.keys()) {
				const oldShell = name.startsWith('chronolog-shell-') && name !== SHELL_CACHE;
				const legacy = LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));
				// Kept pages name the old version's files: drop them with it (they refill online)
				if (oldShell || legacy || (name === PAGE_CACHE && build.length > 0)) await caches.delete(name);
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
	try {
		const response = await fetch(request);
		if (response.ok && response.type === 'basic') {
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
