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

const registry = $state({ sidebarWidgetCount: 0, footerWidgetCount: 0, screenWidgetCount: 0 });

export type TimerWidgetPlacement = 'sidebar' | 'footer' | 'screen';

/** Call from a TimerWidget on mount; returns the unregister function. */
export function registerTimerWidget(placement: TimerWidgetPlacement): () => void {
	const field =
		placement === 'sidebar' ? 'sidebarWidgetCount' : placement === 'footer' ? 'footerWidgetCount' : 'screenWidgetCount';
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

/** Reactive: how many TimerWidgets (sidebar, footer and the phone capture screen) are on the page. */
export function mountedTimerWidgetCount(): number {
	return registry.sidebarWidgetCount + registry.footerWidgetCount + registry.screenWidgetCount;
}

/*
 * The phone capture screen (sprint 055-DR) is an overlay, so the timesheet's footer widget can
 * stay mounted underneath it. Each widget keeps its own local state, so a widget that changes the
 * capture (start, stop, save, discard) announces it and every other mounted widget reloads from
 * the server and the pending timer. One timer model; the copies only re-read it.
 */
const captureChanges = $state({ version: 0, sourceWidgetId: '' });

export function announceCaptureChange(sourceWidgetId: string): void {
	untrack(() => {
		captureChanges.sourceWidgetId = sourceWidgetId;
		captureChanges.version += 1;
	});
}

/** Reactive: the latest change, for a widget's $effect to compare with its own id */
export function latestCaptureChange(): { version: number; sourceWidgetId: string } {
	return { version: captureChanges.version, sourceWidgetId: captureChanges.sourceWidgetId };
}
