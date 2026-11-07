/**
 * What the shell is actually presenting (sprint 053-DR), for components outside AppShell.
 *
 * AppShell writes it; others read it. `sidebarOnScreen` is false when the desktop sidebar is
 * hidden with ≡ (0px wide, still mounted), when the tablet overlay is closed, and on a phone
 * screen other than home. Stage 3b's notes list header reads it to decide whether the list
 * header repeats the context the sidebar would otherwise show.
 */
import type { LayoutMode } from '$lib/stores/navigation.svelte';

export const shellPresentation = $state<{
	layoutMode: LayoutMode;
	/** The navigation sidebar is visible (expanded) on screen */
	sidebarOnScreen: boolean;
	/** A TimerWidget (expanded or compact) is on screen; when false the header reflects the capture */
	timerWidgetOnScreen: boolean;
}>({
	layoutMode: 'desktop',
	sidebarOnScreen: true,
	timerWidgetOnScreen: true
});
