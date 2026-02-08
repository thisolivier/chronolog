/**
 * Time input parsing utility for inline time editing.
 *
 * Supports two main formats:
 * - Time ranges: "HH:MM-HH:MM" (e.g. "09:00-17:30")
 * - Duration strings: "Xh Ym", "Xh", "Ym", "XhYm" (e.g. "2h 30m", "2h", "45m", "2h30m")
 */

export type TimeParseResult =
	| { type: 'duration'; durationMinutes: number }
	| { type: 'range'; startTime: string; endTime: string; durationMinutes: number }
	| { type: 'invalid' };

const TIME_RANGE_PATTERN = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
const HOURS_AND_MINUTES_PATTERN = /^(\d+)\s*h\s*(\d+)\s*m$/i;
const HOURS_ONLY_PATTERN = /^(\d+)\s*h$/i;
const MINUTES_ONLY_PATTERN = /^(\d+)\s*m$/i;

/** Parse a time input string into a structured result. */
export function parseTimeInput(input: string): TimeParseResult {
	const trimmedInput = input.trim();

	if (trimmedInput.length === 0) {
		return { type: 'invalid' };
	}

	// Try time range format first: HH:MM-HH:MM
	const rangeMatch = trimmedInput.match(TIME_RANGE_PATTERN);
	if (rangeMatch) {
		return parseTimeRange(rangeMatch);
	}

	// Try duration formats
	const durationResult = parseDuration(trimmedInput);
	if (durationResult !== null) {
		return { type: 'duration', durationMinutes: durationResult };
	}

	return { type: 'invalid' };
}

/** Parse a time range match into a TimeParseResult. */
function parseTimeRange(match: RegExpMatchArray): TimeParseResult {
	const startHours = parseInt(match[1], 10);
	const startMinutes = parseInt(match[2], 10);
	const endHours = parseInt(match[3], 10);
	const endMinutes = parseInt(match[4], 10);

	if (startHours > 23 || startMinutes > 59 || endHours > 23 || endMinutes > 59) {
		return { type: 'invalid' };
	}

	const startTotalMinutes = startHours * 60 + startMinutes;
	const endTotalMinutes = endHours * 60 + endMinutes;

	if (endTotalMinutes <= startTotalMinutes) {
		return { type: 'invalid' };
	}

	const startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:00`;
	const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;
	const durationMinutes = endTotalMinutes - startTotalMinutes;

	return { type: 'range', startTime, endTime, durationMinutes };
}

/** Parse a duration string, returning total minutes or null if invalid. */
function parseDuration(input: string): number | null {
	// Try "Xh Ym" or "XhYm"
	const hoursAndMinutesMatch = input.match(HOURS_AND_MINUTES_PATTERN);
	if (hoursAndMinutesMatch) {
		const hours = parseInt(hoursAndMinutesMatch[1], 10);
		const minutes = parseInt(hoursAndMinutesMatch[2], 10);
		if (hours < 0 || minutes < 0) return null;
		const totalMinutes = hours * 60 + minutes;
		return totalMinutes > 0 ? totalMinutes : null;
	}

	// Try "Xh"
	const hoursOnlyMatch = input.match(HOURS_ONLY_PATTERN);
	if (hoursOnlyMatch) {
		const hours = parseInt(hoursOnlyMatch[1], 10);
		return hours > 0 ? hours * 60 : null;
	}

	// Try "Ym" or "YYYm"
	const minutesOnlyMatch = input.match(MINUTES_ONLY_PATTERN);
	if (minutesOnlyMatch) {
		const minutes = parseInt(minutesOnlyMatch[1], 10);
		return minutes > 0 ? minutes : null;
	}

	return null;
}
