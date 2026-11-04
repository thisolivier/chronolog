/**
 * Register `src/service-worker.ts` (SvelteKit builds it; its own registration is off so the
 * Tauri desktop app never gets a worker: there a waiting worker would only take over after a full
 * quit, and the desktop app loads from the network anyway). A module worker in development.
 */
export function registerServiceWorker(isDevelopment: boolean): void {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	navigator.serviceWorker
		.register('/service-worker.js', { type: isDevelopment ? 'module' : 'classic' })
		.catch((registrationError) => console.warn('[Chronolog] service worker registration failed', registrationError));
}

/**
 * "A new version is available" for the app's service worker (sprint 045-CL; it replaces the
 * generated worker's prompt). SvelteKit registers `src/service-worker.ts`; a new version installs
 * and waits. `onUpdateWaiting` gets a function that lets it take over and reloads the page once.
 */
export function watchServiceWorkerUpdates(onUpdateWaiting: (activate: () => void) => void): () => void {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
	const container = navigator.serviceWorker;
	let stopped = false;
	let reloading = false;

	const offer = (waiting: ServiceWorker) => {
		// The first install has no controller to replace: nothing to ask
		if (stopped || !container.controller) return;
		onUpdateWaiting(() => {
			container.addEventListener('controllerchange', () => {
				if (reloading) return;
				reloading = true;
				window.location.reload();
			});
			waiting.postMessage({ type: 'SKIP_WAITING' });
		});
	};

	const watch = (registration: ServiceWorkerRegistration) => {
		if (registration.waiting) offer(registration.waiting);
		registration.addEventListener('updatefound', () => {
			const installing = registration.installing;
			installing?.addEventListener('statechange', () => {
				if (installing.state === 'installed') offer(installing);
			});
		});
	};

	container.ready.then(watch).catch(() => {});
	return () => {
		stopped = true;
	};
}
