/**
 * "Today" and the current week in a given IANA timezone (pure; used by `GET /api/me`). Week keys
 * (`2026-W45`) are ISO 8601 weeks (`iso-week.ts`).
 * A machine client sends its own timezone (`?tz=` or `X-Timezone`); without one the server's
 * zone is used.
 */

import { getSundayOfWeek, isoWeekKey, isoWeekOf } from './iso-week';

export function isValidTimezone(timezone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
		return true;
	} catch {
		return false;
	}
}

/** `YYYY-MM-DD` for `instant` as seen in `timezone`. */
export function localDateString(instant: Date, timezone: string): string {
	// en-CA formats dates as YYYY-MM-DD
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(instant);
}

export interface LocalCalendar {
	timezone: string;
	today: string;
	/** ISO 8601 week key, `2026-W45` */
	week: string;
	/** The same value as `week` (both ISO 8601); kept for older CLIs, which read this name */
	isoWeek: string;
	weekStart: string;
	weekEnd: string;
}

export function localCalendar(instant: Date, timezone: string): LocalCalendar {
	const today = localDateString(instant, timezone);
	const { weekStart } = isoWeekOf(today);
	const week = isoWeekKey(today);
	return { timezone, today, week, isoWeek: week, weekStart, weekEnd: getSundayOfWeek(weekStart) };
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real `YYYY-MM-DD` calendar day (no 2026-02-30). */
export function isCalendarDate(text: string): boolean {
	const match = CALENDAR_DATE_PATTERN.exec(text);
	if (!match) return false;
	const [year, month, day] = match.slice(1).map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The instant that is 12:00 on `dateString` (`YYYY-MM-DD`) in `timezone`. */
export function noonInTimezone(dateString: string, timezone: string): Date {
	const [year, month, day] = dateString.split('-').map(Number);
	const utcNoon = Date.UTC(year, month - 1, day, 12);
	// The wall clock `timezone` shows at UTC noon, read as if it were UTC, gives the zone's offset
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone, hourCycle: 'h23',
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
		})
			.formatToParts(new Date(utcNoon))
			.map((part) => [part.type, Number(part.value)])
	);
	const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	return new Date(utcNoon - (wallClockAsUtc - utcNoon));
}
