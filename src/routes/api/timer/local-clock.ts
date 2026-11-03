/** Validation for the local date/time strings the browser sends to the timer routes. */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** A `YYYY-MM-DD` string, or undefined when the value is missing or malformed. */
export function readLocalDate(value: unknown): string | undefined {
	return typeof value === 'string' && DATE_PATTERN.test(value) ? value : undefined;
}

/** A `HH:MM[:SS]` string, or undefined when the value is missing or malformed. */
export function readLocalTime(value: unknown): string | undefined {
	return typeof value === 'string' && TIME_PATTERN.test(value) ? value : undefined;
}
