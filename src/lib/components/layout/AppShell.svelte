<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';

	interface Props {
		panel1: Snippet;
		panel2: Snippet;
		panel3: Snippet;
	}

	let { panel1, panel2, panel3 }: Props = $props();

	const navigationContext = getNavigationContext();

	// Panel 2 width state (resizable)
	let panel2Width = $state(280);
	let isResizing = $state(false);
	let resizeStartX = $state(0);
	let resizeStartWidth = $state(0);

	const MIN_PANEL2_WIDTH = 200;
	const MAX_PANEL2_WIDTH = 500;

	function handleResizeStart(event: MouseEvent) {
		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartWidth = panel2Width;
		event.preventDefault();
	}

	function handleResizeMove(event: MouseEvent) {
		if (!isResizing) return;
		const deltaX = event.clientX - resizeStartX;
		const newWidth = Math.max(
			MIN_PANEL2_WIDTH,
			Math.min(MAX_PANEL2_WIDTH, resizeStartWidth + deltaX)
		);
		panel2Width = newWidth;
	}

	function handleResizeEnd() {
		isResizing = false;
	}

	// Attach global mouse event listeners for resize
	$effect(() => {
		if (isResizing) {
			window.addEventListener('mousemove', handleResizeMove);
			window.addEventListener('mouseup', handleResizeEnd);

			return () => {
				window.removeEventListener('mousemove', handleResizeMove);
				window.removeEventListener('mouseup', handleResizeEnd);
			};
		}
	});

	// Mobile detection
	let isMobile = $state(false);

	$effect(() => {
		const mediaQuery = window.matchMedia('(max-width: 1023px)');
		isMobile = mediaQuery.matches;

		const handleMediaChange = (event: MediaQueryListEvent) => {
			isMobile = event.matches;
		};

		mediaQuery.addEventListener('change', handleMediaChange);

		return () => {
			mediaQuery.removeEventListener('change', handleMediaChange);
		};
	});
</script>

<svelte:window onmouseup={handleResizeEnd} />

{#if isMobile}
	<!-- Mobile: Single-panel push/pop navigation -->
	<div class="flex h-screen flex-col overflow-hidden bg-white">
		<!-- Back button header when not at level 0 -->
		{#if navigationContext.mobileNavigationLevel > 0}
			<div class="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
				<button
					onclick={() => navigationContext.goBackMobile()}
					class="text-sm font-medium text-blue-600 hover:text-blue-800"
				>
					&larr; Back
				</button>
			</div>
		{/if}

		<!-- Active panel -->
		<div class="flex flex-1 flex-col overflow-y-auto">
			{#if navigationContext.mobileNavigationLevel === 0}
				{@render panel1()}
			{:else if navigationContext.mobileNavigationLevel === 1}
				{@render panel2()}
			{:else}
				{@render panel3()}
			{/if}
		</div>
	</div>
{:else}
	<!-- Desktop: Three-panel layout -->
	<div class="flex h-screen overflow-hidden bg-white">
		<!-- Panel 1: Sidebar (collapsible) -->
		<div
			class="flex-shrink-0 border-r border-gray-200 bg-gray-50 transition-all duration-300"
			style="width: {navigationContext.panel1Collapsed ? 0 : 240}px; overflow: hidden;"
		>
			<div class="flex h-full w-60 flex-col overflow-y-auto">
				{@render panel1()}
			</div>
		</div>

		<!-- Panel 2: List view (resizable) -->
		<div
			class="relative flex-shrink-0 border-r border-gray-200 bg-white"
			style="width: {panel2Width}px;"
		>
			<div class="flex h-full flex-col overflow-y-auto">
				{@render panel2()}
			</div>

			<!-- Resize handle on right edge -->
			<button
				class="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-200 active:bg-blue-300"
				onmousedown={handleResizeStart}
				aria-label="Resize panel"
			></button>
		</div>

		<!-- Panel 3: Content (flexible width) -->
		<div class="flex flex-1 flex-col overflow-y-auto bg-white">
			{@render panel3()}
		</div>
	</div>
{/if}
