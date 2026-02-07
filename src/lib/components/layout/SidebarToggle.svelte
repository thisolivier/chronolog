<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';

	const navigationContext = getNavigationContext();

	function handleToggle() {
		navigationContext.toggleSidebar();
	}
</script>

<button
	onclick={handleToggle}
	class="absolute left-2 top-4 z-10 rounded-md border border-gray-300 bg-white p-1.5 shadow-sm hover:bg-gray-50 active:bg-gray-100"
	aria-label={navigationContext.panel1Collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	title={navigationContext.panel1Collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
>
	{#if navigationContext.panel1Collapsed}
		<!-- Chevron right (expand) -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="h-4 w-4 text-gray-600"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
	{:else}
		<!-- Chevron left (collapse) -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="h-4 w-4 text-gray-600"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
		</svg>
	{/if}
</button>
