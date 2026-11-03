/**
 * Tracks whether the sidebar's TimerWidget is mounted.
 *
 * The phone layout shows one panel at a time, so inside the timesheet the sidebar
 * (and its timer) is not on screen. TimeEntriesPanel renders a footer TimerWidget only
 * while no sidebar widget is mounted, so there is never more than one live timer
 * widget, whatever breakpoint the shell uses.
 */
const registry = $state({ sidebarWidgetCount: 0 });

/** Call from a sidebar TimerWidget on mount; returns the unregister function. */
export function registerSidebarTimerWidget(): () => void {
	registry.sidebarWidgetCount += 1;
	return () => {
		registry.sidebarWidgetCount -= 1;
	};
}

/** Reactive: true while a sidebar TimerWidget is on the page. */
export function isSidebarTimerWidgetMounted(): boolean {
	return registry.sidebarWidgetCount > 0;
}
