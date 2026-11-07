/**
 * Chronolog's week numbering (owner decision 2026-11-07, design r1 TR-07 / O05).
 *
 * Weeks start on Monday. Week 1 of a year is the Monday-start week that contains 1 January, so
 * a week that spans two years belongs to the later one (the year of its Sunday) and the first
 * week of a year may start in late December. Example: 29 Dec 2025 – 4 Jan 2026 is 2026 Week 1;
 * 28 Dec 2026 – 3 Jan 2027 is 2027 Week 1. A year has 52 or 53 weeks.
 *
 * This is NOT ISO 8601 (which starts week 1 at the week with the first Thursday). The two agree
 * whenever 1 January is a Monday to Thursday and differ by one for every week of a year that
 * starts on a Friday, Saturday or Sunday (2027 is one: ISO 2027-W01 is our 2027 Week 2).
 *
 * A week's identity everywhere is its Monday date (`weekStart`, `YYYY-MM-DD`); `YYYY-Www` keys
 * (`2026-W45`) in URLs, the API and the CLI are labels derived from it with this rule.
 * Pure date arithmetic in UTC, so daylight-saving changes never shift a day.
 */

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_KEY_PATTERN = /^(\d{4})-?W(\d{1,2})$/i;

export interface CalendarWeek {
	/** The year the week is numbered in (the year of its Sunday) */
	year: number;
	/** 1–53 */
	weekNumber: number;
	/** The week's Monday, `YYYY-MM-DD`: its identity */
	weekStart: string;
}

function dayNumber(dateString: string): number {
	const match = DATE_PATTERN.exec(dateString);
	if (!match) throw new Error(`Not a YYYY-MM-DD date: ${dateString}`);
	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
}

function dateFromDayNumber(days: number): string {
	return new Date(days * DAY_MS).toISOString().slice(0, 10);
}

/** Days since the epoch of the Monday on or before `days` (1970-01-01 was a Thursday) */
function mondayDayNumber(days: number): number {
	const weekdayFromMonday = (((days + 3) % 7) + 7) % 7; // Monday 0 … Sunday 6
	return days - weekdayFromMonday;
}

/** The Monday that starts Week 1 of `year`: the Monday on or before 1 January */
function firstMondayDayNumber(year: number): number {
	return mondayDayNumber(Date.UTC(year, 0, 1) / DAY_MS);
}

/** The Monday on or before `dateString` */
export function mondayOnOrBefore(dateString: string): string {
	return dateFromDayNumber(mondayDayNumber(dayNumber(dateString)));
}

/** Year, week number and Monday of the week containing `dateString` */
export function calendarWeekOf(dateString: string): CalendarWeek {
	const monday = mondayDayNumber(dayNumber(dateString));
	const year = new Date((monday + 6) * DAY_MS).getUTCFullYear();
	const weekNumber = (monday - firstMondayDayNumber(year)) / 7 + 1;
	return { year, weekNumber, weekStart: dateFromDayNumber(monday) };
}

/** The week number alone ("Week 45") */
export function calendarWeekNumber(dateString: string): number {
	return calendarWeekOf(dateString).weekNumber;
}

/** 52 or 53 */
export function weeksInYear(year: number): number {
	return (firstMondayDayNumber(year + 1) - firstMondayDayNumber(year)) / 7;
}

/** Monday of `year` Week `weekNumber`; null when that week does not exist */
export function mondayOfCalendarWeek(year: number, weekNumber: number): string | null {
	if (!Number.isInteger(year) || !Number.isInteger(weekNumber)) return null;
	if (weekNumber < 1 || weekNumber > weeksInYear(year)) return null;
	return dateFromDayNumber(firstMondayDayNumber(year) + (weekNumber - 1) * 7);
}

/** `2026-W45` for the week containing `dateString` */
export function calendarWeekKey(dateString: string): string {
	const { year, weekNumber } = calendarWeekOf(dateString);
	return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Parses `2026-W45` (also `2026W45`, `2026-w5`); null when malformed or the week does not exist
 * in that year. `key` is the canonical spelling.
 */
export function parseCalendarWeekKey(text: string): (CalendarWeek & { key: string }) | null {
	const match = WEEK_KEY_PATTERN.exec(String(text).trim());
	if (!match) return null;
	const year = Number(match[1]);
	const weekNumber = Number(match[2]);
	const weekStart = mondayOfCalendarWeek(year, weekNumber);
	if (!weekStart) return null;
	return { year, weekNumber, weekStart, key: `${year}-W${String(weekNumber).padStart(2, '0')}` };
}

/** The week before (-1) or after (+1) the week starting `weekStart` */
export function shiftCalendarWeek(weekStart: string, weekOffset: number): string {
	return dateFromDayNumber(mondayDayNumber(dayNumber(weekStart)) + weekOffset * 7);
}

/**
 * Bookmarks from before the 2026-11-07 decision used ISO keys. Where ISO and this rule give the
 * same key the URL is unchanged. ISO has a week 53 in some years where this rule has 52; such a
 * key (e.g. `2026-W53`, ISO Monday 28 Dec 2026) is answered with the key of the same Monday under
 * this rule (`2027-W01`). Returns null when `text` is not such a legacy-only key.
 */
export function legacyIsoWeekRedirect(text: string): string | null {
	const match = WEEK_KEY_PATTERN.exec(String(text).trim());
	if (!match) return null;
	const year = Number(match[1]);
	const weekNumber = Number(match[2]);
	if (mondayOfCalendarWeek(year, weekNumber)) return null;
	// ISO week 1 is the week containing 4 January
	const isoMonday = mondayDayNumber(Date.UTC(year, 0, 4) / DAY_MS) + (weekNumber - 1) * 7;
	const isoYearOfMonday = new Date((isoMonday + 3) * DAY_MS).getUTCFullYear(); // its Thursday's year
	if (weekNumber < 1 || isoYearOfMonday !== year) return null;
	return calendarWeekKey(dateFromDayNumber(isoMonday));
}
