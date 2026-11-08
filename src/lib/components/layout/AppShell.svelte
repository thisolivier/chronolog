<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getTimerStateContext } from '$lib/stores/timer-state.svelte';
	import TimerIndicator from '$lib/components/weekly/TimerIndicator.svelte';
	import PhoneCaptureScreen from '$lib/components/timer/PhoneCaptureScreen.svelte';
	import { captureScreen } from '$lib/components/timer/capture-screen.svelte';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import GlobalSearchField from '$lib/components/search/GlobalSearchField.svelte';
	import AppBarHome from './AppBarHome.svelte';
	import { requestFindInPage } from '$lib/components/find/shortcuts';
	import { titleForRoute } from './navigation-labels';
	import { phoneTitleBarNamesContext } from './note-context-ownership';
	import { getDataService } from '$lib/services/context';
	import { untrack } from 'svelte';
	import {
		headerReflectionFor,
		isTimerWidgetOnScreen,
		type HeaderReflection
	} from '$lib/components/timer/timer-visibility';
	import { isSidebarTimerWidgetMounted, mountedTimerWidgetCount } from '$lib/components/timer/timer-widget-registry.svelte';
	import { loadTimerReflection } from '$lib/components/timer/timer-reflection';
	import { shellPresentation } from './shell-presentation.svelte';

	interface Props {
		panel1: Snippet;
		panel2: Snippet;
		panel3: Snippet;
		/**
		 * The /search page (059-DR, SR-01): replaces the list and content panels (the phone's whole
		 * panel); the header search box is not rendered, the page has its own large query field
		 */
		searchPage?: Snippet;
	}

	let { panel1, panel2, panel3, searchPage }: Props = $props();

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
			navigationContext.setLayoutMode(isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop');
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

	// Phone title bar: Chronolog ‹ › (062-DR, AppBarHome), then the title naming where you are
	// (rule 4); ‹ names where it goes in its accessible name
	const mobileTitle = $derived(titleForRoute(navigationContext.route));
	// Notes screens: the list and editor headers name the context, so no title above them (060-DR);
	// none at the root either, where "Chronolog" already says it
	const mobileTitleShown = $derived(
		navigationContext.mobileNavigationLevel > 0 && phoneTitleBarNamesContext(navigationContext.route.kind)
	);
	// The week or a note is on screen (panel 3): the title bar offers Find, the phone's route to
	// find in page (sprint 047-QA)
	const mobileShowsContentPanel = $derived(
		navigationContext.mobileNavigationLevel >= (navigationContext.isNotesMode ? 2 : 1)
	);

	// One visible timer (SH-04, sprint 053-DR): the header reflects the capture only while no
	// TimerWidget is on screen (timer-visibility.ts encodes the SH-02 state matrix)
	const presentation = $derived({
		layoutMode: isMobile ? ('mobile' as const) : isTablet ? ('tablet' as const) : ('desktop' as const),
		sidebarCollapsed: navigationContext.panel1Collapsed,
		sidebarIsOverlay,
		overlaySidebarOpen,
		mountedWidgetCount: mountedTimerWidgetCount()
	});
	const reflectionNow = $derived(headerReflectionFor(timerState.status, presentation));
	// The sidebar's width animates for 300ms when ≡ hides it: show the pill only once the widget
	// has gone, so the two never appear together. Hiding the pill, and every change on a phone or
	// between running and Finish entry, is immediate.
	const SIDEBAR_TRANSITION_MS = 300;
	let headerReflection = $state<HeaderReflection>('none');
	$effect(() => {
		const next = reflectionNow;
		const shown = untrack(() => headerReflection);
		if (next === 'none' || shown !== 'none' || presentation.layoutMode === 'mobile') {
			headerReflection = next;
			return;
		}
		const timeoutId = setTimeout(() => (headerReflection = next), SIDEBAR_TRANSITION_MS);
		return () => clearTimeout(timeoutId);
	});
	// No capture and the desktop sidebar hidden: keep the pre-053 "Timer" access to Start / Add Entry
	const showIdleTimerAccess = $derived(
		!isMobile && navigationContext.panel1Collapsed && !sidebarIsOverlay && isSidebarTimerWidgetMounted()
	);

	// Hooks for components outside the shell: the notes list and editor headers read sidebarOnScreen
	// (note-context-ownership.ts). A pre-effect, so the panels' first render already sees it.
	$effect.pre(() => {
		shellPresentation.layoutMode = presentation.layoutMode;
		shellPresentation.sidebarOnScreen = isMobile ? navigationContext.mobileNavigationLevel === 0 : sidebarVisible;
		shellPresentation.timerWidgetOnScreen = isTimerWidgetOnScreen(presentation);
	});

	// A phone opened straight on a note mounts no TimerWidget: read the capture once so the
	// header can still reflect it (read-only; the first widget to mount takes over)
	const dataService = getDataService();
	let reflectionRequested = false;
	$effect(() => {
		if (reflectionRequested || mountedTimerWidgetCount() > 0 || timerState.status !== 'idle') return;
		reflectionRequested = true;
		let cancelled = false;
		void loadTimerReflection(dataService).then((reflection) => {
			if (!cancelled && reflection && mountedTimerWidgetCount() === 0) timerState.update(reflection);
		});
		return () => {
			cancelled = true;
		};
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
	<div class="safe-area-shell flex h-dvh flex-col overflow-hidden bg-surface">
		<!-- Mobile top bar (062-DR): Chronolog (home) ‹ › on every screen, /search included, then
		     the title, which truncates before anything else gives way -->
		<!-- Room at 320 px: 12 px gutters, no gaps beside the 44 px icons (their own whitespace spaces
		     them), the pill drops its mark below 420 px and, below 360 px, Find gives way to the pill -->
		<div class="flex h-12 items-center justify-between border-b border-divider bg-surface px-3">
			<div class="flex min-w-0 flex-1 items-center">
				<AppBarHome variant="phone" />
				<!-- With the timer pill showing, the context title is dropped: the list and editor
				     headers already name the context (053-DR) -->
				{#if !searchPage && headerReflection === 'none' && mobileTitleShown}
					<span class="ml-1 min-w-0 truncate text-xs text-ink-faint" data-testid="mobile-context-title">{mobileTitle}</span>
				{/if}
			</div>
			{#if mobileShowsContentPanel && !searchPage}
				<button
					type="button"
					onclick={requestFindInPage}
					class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md btn-quiet {headerReflection === 'none' ? '' : 'max-[359px]:hidden'}"
					aria-label="Find in page"
					data-testid="mobile-find-button"
				>
					<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4" aria-hidden="true"><path d="M4 4h12M4 8h7M4 12h5" stroke-linecap="round" /><circle cx="13.5" cy="13" r="3" /><path d="m15.7 15.2 2.3 2.3" stroke-linecap="round" /></svg>
				</button>
			{/if}
			<!-- Global search (sprint 042-CL): the field gets the whole page on a phone -->
			{#if !searchPage}<a
				href="/search"
				class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md btn-quiet"
				aria-label="Search"
				data-testid="mobile-search-link"
			>
				<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" stroke-linecap="round" /></svg>
			</a>{/if}
			<!-- The capture's reflection, only on screens without a timer widget (SH-04); opens the
			     phone's focused capture screen over this one (TC-08, sprint 055-DR) -->
			<div class="flex-shrink-0">
				<TimerIndicator reflection={headerReflection} onIndicatorClick={() => captureScreen.open()} />
			</div>
		</div>
		<ConnectionStatus mode={navigationContext.mode} />

		<!-- Active panel. Panel 2 (note list) only exists in notes mode; in time mode
		     level 1 goes straight to the time entries panel. -->
		<div class="flex flex-1 flex-col overflow-y-auto">
			{#if searchPage}
				{@render searchPage()}
			{:else if navigationContext.mobileNavigationLevel === 0}
				{@render panel1()}
			{:else if navigationContext.mobileNavigationLevel === 1 && navigationContext.isNotesMode}
				{@render panel2()}
			{:else}
				{@render panel3()}
			{/if}
		</div>
	</div>
	{#if captureScreen.isOpen}<PhoneCaptureScreen />{/if}
{:else}
	<!-- Desktop: Multi-panel layout -->
	<div class="safe-area-shell flex h-dvh flex-col overflow-hidden bg-surface">
		<!-- Top bar -->
		<div class="flex h-12 items-center justify-between border-b border-divider bg-surface px-4" data-testid="app-top-bar">
			<div class="flex flex-shrink-0 items-center gap-3">
				<button
					onclick={toggleSidebar}
					class="text-lg text-ink-faint hover:text-ink-soft"
					aria-label="Toggle sidebar"
					aria-expanded={sidebarVisible}
				>≡</button>
				<!-- Chronolog (home) then Back / Forward (050-UI, 062-DR) -->
				<AppBarHome />
			</div>
			<!-- Right: the capture's reflection when no sidebar timer is on screen (SH-04; clicking it
			     shows the sidebar, where the same widget lives), then global search at the far
			     right (SH-05) -->
			<div class="flex min-w-0 items-center justify-end gap-3" data-testid="app-top-bar-right">
				<TimerIndicator reflection={headerReflection} showIdleAccess={showIdleTimerAccess} onIndicatorClick={openSidebar} />
				<!-- Not on /search, which has one large field above its results (SR-01) -->
				{#if !searchPage}<GlobalSearchField class="w-60 flex-shrink-0 lg:w-72" />{/if}
			</div>
		</div>
		<ConnectionStatus mode={navigationContext.mode} />

		<!-- Panels -->
		<div class="relative flex flex-1 overflow-hidden">
			{#if sidebarIsOverlay && overlaySidebarOpen}
				<button
					class="absolute inset-0 z-20 bg-chalk-950/20"
					aria-label="Close sidebar"
					onclick={() => (overlaySidebarOpen = false)}
				></button>
			{/if}
			<!-- Panel 1: Sidebar (collapsible; an overlay in tablet notes mode) -->
			<div
				class="flex-shrink-0 bg-chalk-50 transition-all duration-300 {sidebarVisible
					? 'border-r border-divider'
					: ''} {sidebarIsOverlay
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
			{#if navigationContext.isNotesMode && !searchPage}
				<div
					class="relative flex-shrink-0 border-r border-divider bg-surface"
					style="width: {isTablet ? Math.min(panel2Width, 260) : panel2Width}px;"
				>
					<div class="flex h-full flex-col overflow-y-auto">
						{@render panel2()}
					</div>

					<!-- Resize handle on right edge -->
					<button
						class="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-pine-200 active:bg-pine-300"
						onmousedown={handleResizeStart}
						aria-label="Resize panel"
					></button>
				</div>
			{/if}

			<!-- Panel 3: Content (flexible width) -->
			<div class="flex flex-1 flex-col overflow-y-auto bg-chalk-50">
				{#if searchPage}{@render searchPage()}{:else}{@render panel3()}{/if}
			</div>
		</div>
	</div>
{/if}
