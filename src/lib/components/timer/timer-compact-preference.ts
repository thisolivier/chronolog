/**
 * Whether the desktop sidebar timer is collapsed to its compact row (SH-06, sprint 053-DR).
 * A per-browser presentation preference, like the sidebar's own hide preference: it never
 * changes the capture.
 */
export const TIMER_COMPACT_KEY = 'chronolog:timer-compact';

export function readTimerCompact(storage: Storage | null = browserStorage()): boolean {
	try {
		return storage?.getItem(TIMER_COMPACT_KEY) === 'true';
	} catch {
		return false;
	}
}

export function writeTimerCompact(isCompact: boolean, storage: Storage | null = browserStorage()): void {
	try {
		if (isCompact) storage?.setItem(TIMER_COMPACT_KEY, 'true');
		else storage?.removeItem(TIMER_COMPACT_KEY);
	} catch {
		// Blocked storage: the choice lasts for this page
	}
}

function browserStorage(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage;
	} catch {
		return null;
	}
}
