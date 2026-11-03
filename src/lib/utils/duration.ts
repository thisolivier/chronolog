/**
 * The one duration parser and formatter for time entries.
 *
 * Used by every entry form (inline new-entry row, card time editor, Add Entry modal,
 * timer completion form) so they all accept the same input and show the same output.
 *
 * Accepted input (case-insensitive, surrounding spaces ignored):
 * - decimal hours:     `1.5`, `.5`, `1,5`, `1.5h`, `2h`, `2 hrs`
 * - hours and minutes: `1:30`, `2h30m`, `2h 30m`, `2h 30`, `2 h 30 min`
 * - bare minutes:      `90`, `90m`, `90 min`, `45 mins`
 * - a time range:      `09:00-11:15`, `9-10:30`, `9:00 – 17:00` (en dash allowed)
 *
 * Rejected: empty input, zero, anything over 24 hours, malformed text, a range whose
 * end is not after its start. Anything over 12 hours is accepted with a warning.
 */

export const MAX_DURATION_MINUTES = 24 * 60;
export const LONG_DURATION_WARNING_MINUTES = 12 * 60;
export const DURATION_FORMAT_HINT = 'Try 1h30m, 1.5, 1:30, 90m or 9:00-10:30';
export const DURATION_PLACEHOLDER = '1h30m or 9:00-10:30';

export type DurationParseSuccess =
	| { ok: true; kind: 'duration'; durationMinutes: number; warning?: string }
	| {
			ok: true;
			kind: 'range';
			/** `HH:MM:SS` */
			startTime: string;
			/** `HH:MM:SS` */
			endTime: string;
			durationMinutes: number;
			warning?: string;
	  };

export type DurationParseResult = DurationParseSuccess | { ok: false; error: string };

const HOURS_SUFFIX = 'h(?:rs?|ours?)?';
const MINUTES_SUFFIX = 'm(?:ins?|inutes?)?';

const RANGE_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/;
const COLON_PATTERN = /^(\d{1,2}):(\d{2})$/;
const BARE_DECIMAL_HOURS_PATTERN = /^(\d*\.\d+)$/;
const BARE_MINUTES_PATTERN = /^(\d+)$/;
const HOURS_PATTERN = new RegExp(`^(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*${HOURS_SUFFIX}$`);
const MINUTES_PATTERN = new RegExp(`^(\\d+)\\s*${MINUTES_SUFFIX}$`);
const HOURS_AND_MINUTES_PATTERN = new RegExp(
	`^(\\d+)\\s*${HOURS_SUFFIX}\\s*(\\d+)\\s*(?:${MINUTES_SUFFIX})?$`
);

/** Parse what a user typed into a time field. */
export function parseDuration(rawInput: string): DurationParseResult {
	const normalizedInput = rawInput
		.trim()
		.toLowerCase()
		.replace(/[‒-―]/g, '-')
		.replace(/(\d),(\d)/g, '$1.$2');

	if (normalizedInput.length === 0) {
		return { ok: false, error: 'Enter a time' };
	}

	const rangeMatch = normalizedInput.match(RANGE_PATTERN);
	if (rangeMatch) return parseRange(rangeMatch);

	const minutes = parseDurationMinutes(normalizedInput);
	if (minutes === null) {
		return { ok: false, error: DURATION_FORMAT_HINT };
	}
	const limitError = checkLimits(minutes);
	if (limitError) return { ok: false, error: limitError };

	return withWarning({ ok: true, kind: 'duration', durationMinutes: minutes });
}

/** Total minutes for the non-range forms, or null when the text matches none of them. */
function parseDurationMinutes(input: string): number | null {
	const colonMatch = input.match(COLON_PATTERN);
	if (colonMatch) {
		const minutes = Number(colonMatch[2]);
		if (minutes > 59) return null;
		return Number(colonMatch[1]) * 60 + minutes;
	}

	const hoursAndMinutesMatch = input.match(HOURS_AND_MINUTES_PATTERN);
	if (hoursAndMinutesMatch) {
		const minutes = Number(hoursAndMinutesMatch[2]);
		if (minutes > 59) return null;
		return Number(hoursAndMinutesMatch[1]) * 60 + minutes;
	}

	const hoursMatch = input.match(HOURS_PATTERN) ?? input.match(BARE_DECIMAL_HOURS_PATTERN);
	if (hoursMatch) return Math.round(Number(hoursMatch[1]) * 60);

	const minutesMatch = input.match(MINUTES_PATTERN) ?? input.match(BARE_MINUTES_PATTERN);
	if (minutesMatch) return Number(minutesMatch[1]);

	return null;
}

function parseRange(match: RegExpMatchArray): DurationParseResult {
	const startHours = Number(match[1]);
	const startMinutes = Number(match[2] ?? 0);
	const endHours = Number(match[3]);
	const endMinutes = Number(match[4] ?? 0);

	if (startHours > 23 || endHours > 23 || startMinutes > 59 || endMinutes > 59) {
		return { ok: false, error: 'Times must be between 00:00 and 23:59' };
	}

	const startTotal = startHours * 60 + startMinutes;
	const endTotal = endHours * 60 + endMinutes;
	if (endTotal <= startTotal) {
		return { ok: false, error: 'The end time must be after the start time' };
	}

	return withWarning({
		ok: true,
		kind: 'range',
		startTime: toTimeString(startHours, startMinutes),
		endTime: toTimeString(endHours, endMinutes),
		durationMinutes: endTotal - startTotal
	});
}

/**
 * Server-side check for a stored duration: a whole number of minutes, 1 to 24 hours.
 * Returns an error message, or null when the value is acceptable.
 */
export function validateDurationMinutes(value: unknown): string | null {
	if (typeof value !== 'number' || !Number.isInteger(value)) {
		return 'durationMinutes must be a whole number of minutes';
	}
	return checkLimits(value);
}

function checkLimits(minutes: number): string | null {
	if (minutes <= 0) return 'The time must be more than zero';
	if (minutes > MAX_DURATION_MINUTES) return 'One entry cannot be longer than 24 hours';
	return null;
}

function withWarning(result: DurationParseSuccess): DurationParseSuccess {
	if (result.durationMinutes > LONG_DURATION_WARNING_MINUTES) {
		return { ...result, warning: `That is ${formatMinutes(result.durationMinutes)}; check it is right` };
	}
	return result;
}

function toTimeString(hours: number, minutes: number): string {
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/**
 * Format minutes the one way the app shows hours: `2h 15m`, `2h`, `45m`.
 * Zero reads `0h`; anything above zero never rounds down to zero.
 */
export function formatMinutes(totalMinutes: number): string {
	const wholeMinutes = Math.max(0, Math.round(totalMinutes));
	if (wholeMinutes === 0) return '0h';
	const hours = Math.floor(wholeMinutes / 60);
	const minutes = wholeMinutes % 60;
	if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
	if (hours > 0) return `${hours}h`;
	return `${minutes}m`;
}

/** Tighter form for narrow columns (the week strip): `2h15`, `2h`, `45m`, `0h`. */
export function formatMinutesCompact(totalMinutes: number): string {
	const wholeMinutes = Math.max(0, Math.round(totalMinutes));
	const hours = Math.floor(wholeMinutes / 60);
	const minutes = wholeMinutes % 60;
	if (hours > 0 && minutes > 0) return `${hours}h${String(minutes).padStart(2, '0')}`;
	if (hours > 0) return `${hours}h`;
	if (minutes > 0) return `${minutes}m`;
	return '0h';
}

/**
 * Format a stored start/end pair (`HH:MM[:SS]`) as `09:00-11:15`. When both fall in the
 * same minute (a very short timer run) only the start is shown, never `08:03-08:03`.
 */
export function formatTimeRange(startTime: string | null, endTime: string | null): string | null {
	if (!startTime || !endTime) return null;
	const start = startTime.substring(0, 5);
	const end = endTime.substring(0, 5);
	return start === end ? start : `${start}-${end}`;
}

/** The text a time field is pre-filled with when editing an existing entry. */
export function formatDurationInput(
	durationMinutes: number,
	startTime: string | null,
	endTime: string | null
): string {
	const range = formatTimeRange(startTime, endTime);
	if (range && range.includes('-')) return range;
	return formatMinutes(durationMinutes).replace(' ', '');
}
