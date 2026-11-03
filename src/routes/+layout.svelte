<script lang="ts">
	import '../app.css';
	import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';
	import { createTimerState, setTimerStateContext } from '$lib/stores/timer-state.svelte';
	import { setDataServiceContext } from '$lib/services/context';
	import { FetchDataService } from '$lib/services/fetch-data-service';
	import { DelegatingDataService } from '$lib/services/delegating-data-service';
	import ConnectionStatus from '$lib/components/layout/ConnectionStatus.svelte';

	let { children, data } = $props();

	// Initialize navigation context for authenticated users
	// This is called once during component init and won't change
	// (user authentication state changes require page reload via auth redirects)
	const navState = data.user ? createNavigationState() : null;
	if (navState) {
		setNavigationContext(navState);
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

{#if data.user}
	<ConnectionStatus />
{/if}

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
