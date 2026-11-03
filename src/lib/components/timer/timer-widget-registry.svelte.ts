/**
 * Tracks whether the sidebar's TimerWidget is mounted.
 *
 * The phone layout shows one panel at a time, so inside the timesheet the sidebar
 * (and its timer) is not on screen. TimeEntriesPanel renders a footer TimerWidget only
 * while no sidebar widget is mounted, so there is never more than one live timer
 * widget, whatever breakpoint the shell uses.
 */
import { untrack } from 'svelte';

const registry = $state({ sidebarWidgetCount: 0 });

/** Call from a sidebar TimerWidget on mount; returns the unregister function. */
export function registerSidebarTimerWidget(): () => void {
	// untrack: called from an $effect, which must not depend on the count it changes
	untrack(() => (registry.sidebarWidgetCount += 1));
	return () => {
		untrack(() => (registry.sidebarWidgetCount -= 1));
	};
}

/** Reactive: true while a sidebar TimerWidget is on the page. */
export function isSidebarTimerWidgetMounted(): boolean {
	return registry.sidebarWidgetCount > 0;
}
