<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getTimerStateContext } from '$lib/stores/timer-state.svelte';
	import TimerIndicator from '$lib/components/weekly/TimerIndicator.svelte';
	import ConnectionStatus from './ConnectionStatus.svelte';

	interface Props {
		panel1: Snippet;
		panel2: Snippet;
		panel3: Snippet;
	}

	let { panel1, panel2, panel3 }: Props = $props();

	const navigationContext = getNavigationContext();
	const timerState = getTimerStateContext();

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

	// Breakpoints (sprint 026-CL, finding 17):
	// - below 768px: single-panel mobile drill-down
	// - 768–1023px (tablet / half-screen laptop): two panels; in notes mode the sidebar becomes an
	//   overlay opened with ≡ so the note list and editor keep their width
	// - 1024px and up: sidebar + list + editor
	// Tablet and desktop share one DOM branch, so crossing 1024px never remounts the editor.
	let isMobile = $state(false);
	let isTablet = $state(false);

	$effect(() => {
		const mobileQuery = window.matchMedia('(max-width: 767px)');
		const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
		const update = () => {
			isMobile = mobileQuery.matches;
			isTablet = tabletQuery.matches;
		};
		update();
		mobileQuery.addEventListener('change', update);
		tabletQuery.addEventListener('change', update);
		return () => {
			mobileQuery.removeEventListener('change', update);
			tabletQuery.removeEventListener('change', update);
		};
	});

	const sidebarIsOverlay = $derived(isTablet && navigationContext.isNotesMode);
	let overlaySidebarOpen = $state(false);
	const sidebarVisible = $derived(
		sidebarIsOverlay ? overlaySidebarOpen : !navigationContext.panel1Collapsed
	);

	// Picking a contract (or switching mode) closes the overlay sidebar
	$effect(() => {
		void navigationContext.selectedContractId;
		void navigationContext.mode;
		overlaySidebarOpen = false;
	});

	function toggleSidebar() {
		if (sidebarIsOverlay) overlaySidebarOpen = !overlaySidebarOpen;
		else navigationContext.toggleSidebar();
	}

	function openSidebar() {
		if (sidebarIsOverlay) overlaySidebarOpen = true;
		else if (navigationContext.panel1Collapsed) navigationContext.toggleSidebar();
	}
</script>

<svelte:window onmouseup={handleResizeEnd} />

{#if isMobile}
	<!-- Mobile: Single-panel push/pop navigation -->
	<div class="flex h-screen flex-col overflow-hidden bg-white">
		<!-- Mobile top bar: app name at the root, Back button once pushed in -->
		<div class="flex h-12 items-center justify-between border-b border-stone-200 bg-white px-4">
			<div class="flex items-center gap-3">
				{#if navigationContext.mobileNavigationLevel > 0}
					<button
						onclick={() => navigationContext.goBackMobile()}
						class="text-sm font-medium text-blue-600 hover:text-blue-800"
					>
						&larr; Back
					</button>
				{:else}
					<span class="text-sm font-semibold text-stone-700">Chronolog</span>
				{/if}
			</div>
			{#if navigationContext.mobileNavigationLevel > 0}
				<TimerIndicator
					timerState={timerState.status}
					elapsedSeconds={timerState.elapsedSeconds}
					description={timerState.description}
					contractName={timerState.contractName}
					clientColorIndex={timerState.clientColorIndex}
					onIndicatorClick={() => navigationContext.navigateMobile(0)}
				/>
			{/if}
		</div>
		<ConnectionStatus mode={navigationContext.mode} />

		<!-- Active panel. Panel 2 (note list) only exists in notes mode; in time mode
		     level 1 goes straight to the time entries panel. -->
		<div class="flex flex-1 flex-col overflow-y-auto">
			{#if navigationContext.mobileNavigationLevel === 0}
				{@render panel1()}
			{:else if navigationContext.mobileNavigationLevel === 1 && navigationContext.isNotesMode}
				{@render panel2()}
			{:else}
				{@render panel3()}
			{/if}
		</div>
	</div>
{:else}
	<!-- Desktop: Multi-panel layout -->
	<div class="flex h-screen flex-col overflow-hidden bg-white">
		<!-- Top bar -->
		<div class="flex h-12 items-center justify-between border-b border-stone-200 bg-white px-4">
			<div class="flex items-center gap-3">
				<button
					onclick={toggleSidebar}
					class="text-lg text-stone-500 hover:text-stone-700"
					aria-label="Toggle sidebar"
					aria-expanded={sidebarVisible}
				>≡</button>
				<span class="text-sm font-semibold text-stone-700">Chronolog</span>
			</div>
			<TimerIndicator
				timerState={timerState.status}
				elapsedSeconds={timerState.elapsedSeconds}
				description={timerState.description}
				contractName={timerState.contractName}
				clientColorIndex={timerState.clientColorIndex}
				onIndicatorClick={openSidebar}
			/>
		</div>
		<ConnectionStatus mode={navigationContext.mode} />

		<!-- Panels -->
		<div class="relative flex flex-1 overflow-hidden">
			{#if sidebarIsOverlay && overlaySidebarOpen}
				<button
					class="absolute inset-0 z-20 bg-black/20"
					aria-label="Close sidebar"
					onclick={() => (overlaySidebarOpen = false)}
				></button>
			{/if}
			<!-- Panel 1: Sidebar (collapsible; an overlay in tablet notes mode) -->
			<div
				class="flex-shrink-0 border-r border-stone-200 bg-stone-50 transition-all duration-300 {sidebarIsOverlay
					? 'absolute inset-y-0 left-0 z-30 shadow-xl'
					: ''}"
				style="width: {sidebarVisible ? 240 : 0}px; overflow: hidden;"
				data-testid="app-sidebar"
			>
				<div class="flex h-full w-60 flex-col overflow-y-auto">
					{@render panel1()}
				</div>
			</div>

			<!-- Panel 2: List view (resizable, only in notes mode) -->
			{#if navigationContext.isNotesMode}
				<div
					class="relative flex-shrink-0 border-r border-stone-200 bg-white"
					style="width: {isTablet ? Math.min(panel2Width, 260) : panel2Width}px;"
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
			{/if}

			<!-- Panel 3: Content (flexible width) -->
			<div class="flex flex-1 flex-col overflow-y-auto bg-stone-50">
				{@render panel3()}
			</div>
		</div>
	</div>
{/if}
