/**
 * Tracks which TimerWidgets are mounted.
 *
 * The phone layout shows one panel at a time, so inside the timesheet the sidebar
 * (and its timer) is not on screen. TimeEntriesPanel renders a footer TimerWidget only
 * while no sidebar widget is mounted, so there is never more than one live timer
 * widget, whatever breakpoint the shell uses.
 *
 * The header reflection (sprint 053-DR, `timer-visibility.ts`) also needs to know whether any
 * widget is mounted at all: on a phone note screen none is, so the header shows the capture.
 */
import { untrack } from 'svelte';

const registry = $state({ sidebarWidgetCount: 0, footerWidgetCount: 0 });

/** Call from a TimerWidget on mount; returns the unregister function. */
export function registerTimerWidget(placement: 'sidebar' | 'footer'): () => void {
	const field = placement === 'sidebar' ? 'sidebarWidgetCount' : 'footerWidgetCount';
	// untrack: called from an $effect, which must not depend on the count it changes
	untrack(() => (registry[field] += 1));
	return () => {
		untrack(() => (registry[field] -= 1));
	};
}

/** Call from a sidebar TimerWidget on mount; returns the unregister function. */
export function registerSidebarTimerWidget(): () => void {
	return registerTimerWidget('sidebar');
}

/** Reactive: true while a sidebar TimerWidget is on the page. */
export function isSidebarTimerWidgetMounted(): boolean {
	return registry.sidebarWidgetCount > 0;
}

/** Reactive: how many TimerWidgets (sidebar and footer) are on the page. */
export function mountedTimerWidgetCount(): number {
	return registry.sidebarWidgetCount + registry.footerWidgetCount;
}
