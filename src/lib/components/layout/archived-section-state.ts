/**
 * Whether the sidebar's Archived item is expanded: a per-browser preference, collapsed by default.
 * Storage can be missing or throw (private windows, blocked site data), so every access is guarded.
 */
export const ARCHIVED_EXPANDED_STORAGE_KEY = 'chronolog:sidebar-archived-expanded';

export function readArchivedExpanded(storage: Storage | null | undefined): boolean {
	try {
		return storage?.getItem(ARCHIVED_EXPANDED_STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

export function writeArchivedExpanded(storage: Storage | null | undefined, isExpanded: boolean): void {
	try {
		storage?.setItem(ARCHIVED_EXPANDED_STORAGE_KEY, String(isExpanded));
	} catch {
		// Not remembered in this browser; the toggle still works for this page
	}
}

export function browserLocalStorage(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage;
	} catch {
		return null;
	}
}
