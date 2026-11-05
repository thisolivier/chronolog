/**
 * Keyboard shortcuts for the top bar's Back / Forward (sprint 050-UI): Cmd+[ / Cmd+] on macOS
 * and iOS (Ctrl elsewhere), and Alt+Left / Alt+Right everywhere. Never while typing: a text
 * field or the note editor keeps those keys (Alt+Left moves by word there).
 */
import { isApplePlatform } from '$lib/components/find/shortcuts';

export type HistoryDirection = 'back' | 'forward';

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'target'>;

/** An input, a text area, a select or anything editable (the TipTap editor is contenteditable) */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!target || typeof (target as Element).closest !== 'function') return false;
	const element = target as HTMLElement;
	if (element.isContentEditable) return true;
	return element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null;
}

export function historyShortcutDirection(event: ShortcutEvent, applePlatform = isApplePlatform()): HistoryDirection | null {
	if (event.shiftKey || isTypingTarget(event.target)) return null;
	const commandKey = applePlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
	if (commandKey && !event.altKey) {
		if (event.key === '[' || event.code === 'BracketLeft') return 'back';
		if (event.key === ']' || event.code === 'BracketRight') return 'forward';
		return null;
	}
	if (event.altKey && !event.metaKey && !event.ctrlKey) {
		if (event.key === 'ArrowLeft') return 'back';
		if (event.key === 'ArrowRight') return 'forward';
	}
	return null;
}
