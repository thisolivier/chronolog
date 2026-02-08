<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';
	import { SyncedDataService, setDataServiceContext } from '$lib/sync';

	let { children, data } = $props();

	// Initialize navigation context for authenticated users
	// This is called once during component init and won't change
	// (user authentication state changes require page reload via auth redirects)
	const navState = data.user ? createNavigationState() : null;
	if (navState) {
		setNavigationContext(navState);
	}

	// Initialize data service for authenticated users
	const dataService = data.user ? new SyncedDataService() : null;
	if (dataService) {
		setDataServiceContext(dataService);
	}

	onMount(async () => {
		if (dataService) {
			await dataService.initialize();
		}
	});

	onDestroy(() => {
		dataService?.destroy();
	});
</script>

{@render children()}
