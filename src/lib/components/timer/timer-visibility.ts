/**
 * One visible timer (design r1 SH-04 / SH-06, sprint 053-DR).
 *
 * The header reflection (TimerIndicator) shows only when no TimerWidget is actually on screen.
 * The rule follows presentation, not the route: a hidden desktop sidebar is 0px wide but its
 * widget stays mounted, so "mounted" is not "visible". A compact (collapsed) sidebar widget still
 * counts as visible. On a phone only one panel exists at a time, so a mounted widget (the home
 * sidebar's or the timesheet footer's) is on screen.
 */
import type { LayoutMode } from '$lib/stores/navigation.svelte';

export type CaptureStatus = 'idle' | 'running' | 'stopped';

/** What the header shows: nothing, the running reflection, or "Finish entry" for a stopped capture */
export type HeaderReflection = 'none' | 'running' | 'finish';

export interface ShellPresentation {
	layoutMode: LayoutMode;
	/** The desktop "hide the sidebar" preference (≡) */
	sidebarCollapsed: boolean;
	/** Tablet notes mode: the sidebar is an overlay opened with ≡ */
	sidebarIsOverlay: boolean;
	overlaySidebarOpen: boolean;
	/** TimerWidgets on the page (sidebar and phone timesheet footer) */
	mountedWidgetCount: number;
}

/** Is a TimerWidget (expanded or compact) on screen? */
export function isTimerWidgetOnScreen(presentation: ShellPresentation): boolean {
	if (presentation.mountedWidgetCount === 0) return false;
	if (presentation.layoutMode === 'mobile') return true;
	return presentation.sidebarIsOverlay ? presentation.overlaySidebarOpen : !presentation.sidebarCollapsed;
}

/** SH-02 state matrix: the header shows capture access only while no widget is on screen */
export function headerReflectionFor(
	status: CaptureStatus | 'paused',
	presentation: ShellPresentation
): HeaderReflection {
	if (status === 'idle') return 'none';
	if (isTimerWidgetOnScreen(presentation)) return 'none';
	return status === 'stopped' ? 'finish' : 'running';
}
