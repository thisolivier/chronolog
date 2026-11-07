/**
 * Typed clock times (sprint 060-DR). The running timer's Started field and the split's From / To
 * are text fields, not `<input type="time">`, so they read 24-hour everywhere: a native time
 * input follows the browser's locale (12-hour under en-US) whatever the page's `lang` says.
 *
 * Accepted (surrounding spaces ignored): `13:46`, `9:05`, `9.05`, `0905`, `905`, `9` (on the hour).
 */

const CLOCK_PATTERN = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/;

/** `HH:MM` for what was typed, or null when it is not a time of day (00:00 to 23:59). */
export function parseClockText(rawText: string): string | null {
	const text = rawText.trim().toLowerCase();
	const match = text.match(CLOCK_PATTERN) ?? text.match(/^(\d{1,2})(\d{2})$/);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2] ?? 0);
	if (hours > 23 || minutes > 59) return null;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** True once a field holds a whole `HH:MM` (two-digit hours): safe to apply while typing. */
export function isWholeClockText(text: string): boolean {
	return /^\d{2}:\d{2}$/.test(text.trim()) && parseClockText(text) !== null;
}
