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

	// Initialize data service for authenticated users.
	// A DelegatingDataService wraps the active implementation so that
	// existing component references remain valid if we swap backends.
	const delegatingService = data.user ? new DelegatingDataService(new FetchDataService()) : null;
	if (delegatingService) {
		setDataServiceContext(delegatingService);
	}
</script>

{@render children()}
