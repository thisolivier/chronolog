/**
 * "Today" and the current ISO week in a given IANA timezone (pure; used by `GET /api/me`).
 * A machine client sends its own timezone (`?tz=` or `X-Timezone`); without one the server's
 * zone is used.
 */

import { getIsoWeekNumber, getIsoYear, getMondayOfIsoWeek, getSundayOfWeek } from './iso-week';

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

/** `2026-W45` for a `YYYY-MM-DD` date. */
export function isoWeekKey(dateString: string): string {
	return `${getIsoYear(dateString)}-W${String(getIsoWeekNumber(dateString)).padStart(2, '0')}`;
}

const ISO_WEEK_PATTERN = /^(\d{4})-W(\d{1,2})$/i;

/** Parses `2026-W45`; null when malformed or out of range. */
export function parseIsoWeekKey(weekKey: string): { year: number; weekNumber: number } | null {
	const match = weekKey.trim().match(ISO_WEEK_PATTERN);
	if (!match) return null;
	const year = Number(match[1]);
	const weekNumber = Number(match[2]);
	if (weekNumber < 1 || weekNumber > 53) return null;
	return { year, weekNumber };
}

export interface LocalCalendar {
	timezone: string;
	today: string;
	isoWeek: string;
	weekStart: string;
	weekEnd: string;
}

export function localCalendar(instant: Date, timezone: string): LocalCalendar {
	const today = localDateString(instant, timezone);
	const weekStart = getMondayOfIsoWeek(getIsoYear(today), getIsoWeekNumber(today));
	return { timezone, today, isoWeek: isoWeekKey(today), weekStart, weekEnd: getSundayOfWeek(weekStart) };
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
