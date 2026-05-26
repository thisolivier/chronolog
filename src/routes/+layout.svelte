<script lang="ts">
	import '../app.css';
	import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';
	import { setDataServiceContext } from '$lib/services/context';
	import { FetchDataService } from '$lib/services/fetch-data-service';
	import { DelegatingDataService } from '$lib/services/delegating-data-service';

	let { children, data } = $props();

	// Initialize navigation context for authenticated users
	// This is called once during component init and won't change
	// (user authentication state changes require page reload via auth redirects)
	const navState = data.user ? createNavigationState() : null;
	if (navState) {
		setNavigationContext(navState);
	}

	// Start with FetchDataService — works in all modes and renders immediately.
	const delegatingService = data.user ? new DelegatingDataService(new FetchDataService()) : null;
	if (delegatingService) {
		setDataServiceContext(delegatingService);
	}

	// In powersync mode, asynchronously connect and swap the delegate.
	const syncMode = import.meta.env.PUBLIC_SYNC_MODE as string | undefined;
	if (data.user && delegatingService && syncMode === 'powersync') {
		import('$lib/powersync/database').then(async ({ connectPowerSync }) => {
			const { PowerSyncDataService } = await import('$lib/powersync/powersync-data-service');
			const database = await connectPowerSync();
			delegatingService.setDelegate(new PowerSyncDataService(database));
			console.log('[Chronolog] PowerSync connected — switched to PowerSyncDataService');
		}).catch((error) => {
			console.error('[Chronolog] PowerSync init failed — staying on FetchDataService:', error);
		});
	}
</script>

{@render children()}
