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
