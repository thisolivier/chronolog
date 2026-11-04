/**
 * Keyboard shortcuts for search (sprint 042-CL): Cmd+F / Cmd+K on macOS (and iOS), Ctrl+F /
 * Ctrl+K elsewhere. Cmd+K is free in the editor (TipTap binds no Mod-k here).
 */

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

export function isApplePlatform(): boolean {
	if (typeof navigator === 'undefined') return false;
	const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
	return /mac|iphone|ipad|ipod/i.test(platform);
}

function isModifiedKey(event: ShortcutEvent, key: string, applePlatform: boolean): boolean {
	if (event.altKey || event.shiftKey || event.key.toLowerCase() !== key) return false;
	return applePlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/** Cmd+F (Apple) / Ctrl+F (elsewhere): find in page */
export function isFindShortcut(event: ShortcutEvent, applePlatform = isApplePlatform()): boolean {
	return isModifiedKey(event, 'f', applePlatform);
}

/** Cmd+K (Apple) / Ctrl+K (elsewhere): focus the global search field */
export function isSearchShortcut(event: ShortcutEvent, applePlatform = isApplePlatform()): boolean {
	return isModifiedKey(event, 'k', applePlatform);
}

/** Label for hints and placeholders */
export function shortcutLabel(key: string, applePlatform = isApplePlatform()): string {
	return applePlatform ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}

/**
 * Touch route to find in page (sprint 047-QA): a phone has no Cmd+F, so the phone title bar's
 * Find button sends this window event; the FindBar of the panel on screen opens.
 */
export const OPEN_FIND_EVENT = 'chronolog:open-find';

export function requestFindInPage(): void {
	window.dispatchEvent(new CustomEvent(OPEN_FIND_EVENT));
}
