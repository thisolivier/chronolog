<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { afterNavigate, goto, preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';
	import { createTimerState, setTimerStateContext } from '$lib/stores/timer-state.svelte';
	import { setDataServiceContext } from '$lib/services/context';
	import { FetchDataService } from '$lib/services/fetch-data-service';
	import { DelegatingDataService } from '$lib/services/delegating-data-service';

	let { children, data } = $props();

	// Initialize navigation context for authenticated users
	// This is called once during component init and won't change
	// (user authentication state changes require page reload via auth redirects)
	// The URL is the navigation state (sprint 027-CL): the store starts from this URL, writes
	// user moves back with goto, and re-reads the URL after every navigation, Back included.
	const navState = data.user
		? createNavigationState({
				initialUrl: page.url,
				adapter: {
					navigate: (path, { replace }) =>
						goto(path, { replaceState: replace, noScroll: true, keepFocus: true }),
					back: () => history.back()
				},
				sessionStorage: browser ? safeStorage(() => window.sessionStorage) : null,
				localStorage: browser ? safeStorage(() => window.localStorage) : null
			})
		: null;
	if (navState) {
		setNavigationContext(navState);
		afterNavigate((navigation) => {
			if (!navigation.to) return;
			const loadType =
				navigation.type === 'enter'
					? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type
					: undefined;
			void navState.syncFromUrl(navigation.to.url, navigation.type, navigation.delta, loadType);
		});
	}

	// Load every workspace route's code up front: moving between them is then a pure client-side
	// change that also works offline (a missing chunk would fall back to a full page load).
	$effect(() => {
		if (!navState) return;
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

	// Initialize shared timer state for cross-component communication
	// (TimerWidget publishes; TimerIndicator in AppShell reads)
	const timerState = data.user ? createTimerState() : null;
	if (timerState) {
		setTimerStateContext(timerState);
	}

	// Initialize data service for authenticated users.
	// A DelegatingDataService wraps the active implementation so that
	// existing component references remain valid if we swap backends.
	const delegatingService = data.user ? new DelegatingDataService(new FetchDataService()) : null;
	if (delegatingService) {
		setDataServiceContext(delegatingService);
	}

	// PWA update prompt state
	let showUpdatePrompt = $state(false);
	let pwaRegistration: { update: () => Promise<void> } | null = null;

	// Register PWA service worker — skip in Tauri (native app doesn't need it)
	$effect(() => {
		const isTauri =
			typeof window !== 'undefined' &&
			('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

		if (isTauri) {
			console.log('[Chronolog] Tauri detected — skipping service worker registration');
			return;
		}

		// Dynamically import the virtual PWA module to register the service worker
		import('virtual:pwa-register')
			.then(({ registerSW }) => {
				const updateSW = registerSW({
					onNeedRefresh() {
						showUpdatePrompt = true;
						pwaRegistration = {
							update: async () => {
								await updateSW(true);
							}
						};
					},
					onOfflineReady() {
						console.log('[Chronolog] PWA ready for offline use');
					}
				});
			})
			.catch((error) => {
				console.warn('[Chronolog] Service worker registration failed:', error);
			});
	});

	function handleUpdateAccept() {
		pwaRegistration?.update();
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
		class="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-sm text-white shadow-lg"
		role="alert"
		data-testid="pwa-update-prompt"
	>
		<span>A new version is available</span>
		<button
			onclick={handleUpdateAccept}
			class="rounded bg-white px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
		>
			Update
		</button>
		<button
			onclick={handleUpdateDismiss}
			class="text-blue-200 hover:text-white"
			aria-label="Dismiss update"
		>
			&times;
		</button>
	</div>
{/if}

{@render children()}
