<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';
	import { setDataServiceContext } from '$lib/services/context';
	import { FetchDataService } from '$lib/services/fetch-data-service';
	import { DelegatingDataService } from '$lib/services/delegating-data-service';

	let { children, data } = $props();

	const usePowerSync = env.PUBLIC_SYNC_BACKEND === 'powersync';

	// Initialize navigation context for authenticated users
	// This is called once during component init and won't change
	// (user authentication state changes require page reload via auth redirects)
	const navState = data.user ? createNavigationState() : null;
	if (navState) {
		setNavigationContext(navState);
	}

	// Initialize data service for authenticated users.
	// A DelegatingDataService wraps the active implementation so that
	// existing component references remain valid if we swap backends.
	// Starts with FetchDataService (works immediately, no async required).
	const delegatingService = data.user ? new DelegatingDataService(new FetchDataService()) : null;
	if (delegatingService) {
		setDataServiceContext(delegatingService);
	}

	// When PowerSync is enabled, connect async and swap the delegate
	// once the database is ready. FetchDataService serves requests
	// in the meantime. If PowerSync fails, we stay on FetchDataService.
	if (data.user && usePowerSync && delegatingService) {
		// Capture into a const so TypeScript narrows the type inside the closure
		const service = delegatingService;

		onMount(() => {
			let disposed = false;

			async function initPowerSync() {
				try {
					const { connectPowerSync, disconnectPowerSync } = await import(
						'$lib/powersync/database'
					);
					const { PowerSyncDataService } = await import(
						'$lib/powersync/powersync-data-service'
					);

					const database = await connectPowerSync();

					if (!disposed) {
						service.setDelegate(new PowerSyncDataService(database));
						console.info('[layout] PowerSync connected — data service swapped');
					} else {
						// Component was destroyed before connection completed
						await disconnectPowerSync();
					}
				} catch (error) {
					console.error('[layout] PowerSync connection failed, staying on FetchDataService:', error);
				}
			}

			initPowerSync();

			// Cleanup: disconnect PowerSync when the layout unmounts
			return async () => {
				disposed = true;
				try {
					const { disconnectPowerSync } = await import('$lib/powersync/database');
					await disconnectPowerSync();
					console.info('[layout] PowerSync disconnected');
				} catch {
					// Ignore cleanup errors
				}
			};
		});
	}
</script>

{@render children()}
