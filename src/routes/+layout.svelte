<script lang="ts">
	import '../app.css';
	import { createNavigationState, setNavigationContext } from '$lib/stores/navigation.svelte';

	let { children, data } = $props();

	// Initialize navigation context for authenticated users
	// This is called once during component init and won't change
	// (user authentication state changes require page reload via auth redirects)
	const navState = data.user ? createNavigationState() : null;
	if (navState) {
		setNavigationContext(navState);
	}
</script>

{@render children()}
