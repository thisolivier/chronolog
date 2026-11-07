<script lang="ts">
	import '../app.css';
	import { browser, dev } from '$app/environment';
	import { untrack } from 'svelte';
	import { afterNavigate, goto, preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';
	import { createTimerState, setTimerStateContext } from '$lib/stores/timer-state.svelte';
	import { setDataServiceContext } from '$lib/services/context';
	import { DelegatingDataService } from '$lib/services/delegating-data-service';
	import { OfflineDataService } from '$lib/offline/offline-data-service';
	import { startOfflineSession } from '$lib/offline/offline-session.svelte';
	import { registerServiceWorker, watchServiceWorkerUpdates } from '$lib/offline/service-worker-updates';

	let { children, data } = $props();

	// The root layout always creates the navigation, timer and data-service contexts, signed in or
	// not (044-CL). It mounts once per page load, so a client-side move from a signed-out page
	// (/login, /register, /unlock) into the workspace finds them in place; before, they were made
	// only when the first page had a user, and that move threw "Navigation context not found".
	// The URL is the navigation state (sprint 027-CL): the store starts from this URL, writes
	// user moves back with goto, and re-reads the URL after every navigation, Back included.
	const navState = createNavigationState({
		initialUrl: page.url,
		adapter: {
			navigate: (path, { replace }) => goto(path, { replaceState: replace, noScroll: true, keepFocus: true }),
			back: () => history.back(),
			forward: () => history.forward()
		},
		sessionStorage: browser ? safeStorage(() => window.sessionStorage) : null,
		localStorage: browser ? safeStorage(() => window.localStorage) : null
	});
	setNavigationContext(navState);
	afterNavigate((navigation) => {
		if (!navigation.to) return;
		const loadType =
			navigation.type === 'enter'
				? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type
				: undefined;
		void navState.syncFromUrl(navigation.to.url, navigation.type, navigation.delta, loadType);
	});

	// Once signed in, load every workspace route's code up front: moving between them is then a
	// pure client-side change that also works offline (a missing chunk would fall back to a full
	// page load).
	$effect(() => {
		if (!data.user) return;
		const sampleContract = '00000000-0000-4000-8000-000000000000';
		for (const path of ['/', '/time/2026-W01', `/notes/${sampleContract}`, `/notes/${sampleContract}/new`]) {
			void preloadCode(path).catch(() => {});
		}
	});

	function safeStorage(getStorage: () => Storage): Storage | null {
		try {
			return getStorage();
		} catch {
			return null;
		}
	}

	// Shared timer state (TimerWidget publishes; TimerIndicator in AppShell reads)
	setTimerStateContext(createTimerState());

	// Data service. A DelegatingDataService wraps the active implementation so that existing
	// component references remain valid if we swap backends. OfflineDataService is the fetch
	// service plus the offline outbox (sprint 045-CL).
	setDataServiceContext(new DelegatingDataService(new OfflineDataService()));

	// The signed-in user's outbox and long-lived read cache (sprint 045-CL). Started here, before
	// the panels' first requests, and again if the user signs in without a page load.
	if (browser) untrack(() => data.user?.id && startOfflineSession(data.user.id));
	$effect(() => {
		if (data.user?.id) startOfflineSession(data.user.id);
	});

	// A new version of the app's service worker is waiting (src/service-worker.ts, sprint 045-CL)
	let showUpdatePrompt = $state(false);
	let activateUpdate: (() => void) | null = null;

	// Skipped in Tauri (the native app does not need a service worker)
	$effect(() => {
		const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
		if (isTauri) return;
		registerServiceWorker(dev);
		return watchServiceWorkerUpdates((activate) => {
			activateUpdate = activate;
			showUpdatePrompt = true;
		});
	});

	function handleUpdateAccept() {
		activateUpdate?.();
		showUpdatePrompt = false;
	}

	function handleUpdateDismiss() {
		showUpdatePrompt = false;
	}
</script>

<!-- The offline banner lives inside AppShell and SettingsShell, in the page flow, so it is never
     pushed off-screen by a full-height layout (sprint 026-CL). -->

{#if showUpdatePrompt}
	<div
		class="safe-area-bottom-offset fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg bg-primary px-4 py-3 text-sm text-on-accent shadow-lg"
		role="alert"
		data-testid="pwa-update-prompt"
	>
		<span>A new version is available</span>
		<button
			onclick={handleUpdateAccept}
			class="rounded bg-surface px-3 py-1 text-xs font-medium text-pine-600 hover:bg-pine-50"
		>
			Update
		</button>
		<button
			onclick={handleUpdateDismiss}
			class="text-pine-200 hover:text-on-accent"
			aria-label="Dismiss update"
		>
			&times;
		</button>
	</div>
{/if}

{@render children()}
