/**
 * Chronolog's weeks: ISO 8601 (owner decision 2026-11-07, "ISO 8601 after all", sprint 061-DR).
 *
 * Weeks start on Monday. Week 1 of a year is the week that contains that year's first Thursday
 * (equivalently, 4 January), so a week belongs to the year of its Thursday. A year has 52 or 53
 * weeks: 28 Dec 2026 – 3 Jan 2027 is 2026-W53; 29 Dec 2025 – 4 Jan 2026 is 2026-W01.
 *
 * A week's identity everywhere is its Monday date (`weekStart`, `YYYY-MM-DD`); `YYYY-Www` keys
 * (`2026-W45`) in URLs, the API and the CLI are labels derived from it. The CLI carries a plain-JS
 * copy of this rule (cli/lib/dates.mjs); both are tested against `iso-week.fixtures.json`.
 * Rule arithmetic is in UTC, so daylight-saving changes never shift a day. The display formatters
 * below it work in local time.
 */

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_KEY_PATTERN = /^(\d{4})-?W(\d{1,2})$/i;

export interface IsoWeek {
	/** The ISO week-numbering year (the year of the week's Thursday) */
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

/** The Monday that starts ISO week 1 of `year`: the Monday on or before 4 January */
function firstMondayDayNumber(year: number): number {
	return mondayDayNumber(Date.UTC(year, 0, 4) / DAY_MS);
}

/** The Monday on or before `dateString` */
export function mondayOnOrBefore(dateString: string): string {
	return dateFromDayNumber(mondayDayNumber(dayNumber(dateString)));
}

/** ISO year, week number and Monday of the week containing `dateString` */
export function isoWeekOf(dateString: string): IsoWeek {
	const monday = mondayDayNumber(dayNumber(dateString));
	const year = new Date((monday + 3) * DAY_MS).getUTCFullYear(); // its Thursday's year
	const weekNumber = (monday - firstMondayDayNumber(year)) / 7 + 1;
	return { year, weekNumber, weekStart: dateFromDayNumber(monday) };
}

/** The week number alone ("Week 45") */
export function isoWeekNumber(dateString: string): number {
	return isoWeekOf(dateString).weekNumber;
}

/** 52 or 53 */
export function isoWeeksInYear(year: number): number {
	return (firstMondayDayNumber(year + 1) - firstMondayDayNumber(year)) / 7;
}

/** Monday of ISO week `weekNumber` of `year`; null when that week does not exist */
export function mondayOfIsoWeek(year: number, weekNumber: number): string | null {
	if (!Number.isInteger(year) || !Number.isInteger(weekNumber)) return null;
	if (weekNumber < 1 || weekNumber > isoWeeksInYear(year)) return null;
	return dateFromDayNumber(firstMondayDayNumber(year) + (weekNumber - 1) * 7);
}

/** `2026-W45` for the week containing `dateString` */
export function isoWeekKey(dateString: string): string {
	const { year, weekNumber } = isoWeekOf(dateString);
	return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Parses `2026-W45` (also `2026W45`, `2026-w5`); null when malformed or the week does not exist
 * in that year (`2025-W53`: 2025 has 52 ISO weeks; 2026 has 53). `key` is the canonical spelling.
 */
export function parseIsoWeekKey(text: string): (IsoWeek & { key: string }) | null {
	const match = WEEK_KEY_PATTERN.exec(String(text).trim());
	if (!match) return null;
	const year = Number(match[1]);
	const weekNumber = Number(match[2]);
	const weekStart = mondayOfIsoWeek(year, weekNumber);
	if (!weekStart) return null;
	return { year, weekNumber, weekStart, key: `${year}-W${String(weekNumber).padStart(2, '0')}` };
}

/** The Monday of the week before (-1) or after (+1) the week starting `weekStart` */
export function shiftWeek(weekStart: string, weekOffset: number): string {
	return dateFromDayNumber(mondayDayNumber(dayNumber(weekStart)) + weekOffset * 7);
}

/** Get the Monday of the week containing the given date string. */
export function getMondayOfWeek(dateString: string): string {
	return mondayOnOrBefore(dateString);
}

/** Get the Sunday (end) of the week starting on the given Monday. */
export function getSundayOfWeek(mondayDateString: string): string {
	const monday = new Date(mondayDateString + 'T00:00:00');
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	return formatDateString(sunday);
}

/** Get all 7 date strings (Mon-Sun) for a week starting on the given Monday. */
export function getWeekDates(mondayDateString: string): string[] {
	const monday = new Date(mondayDateString + 'T00:00:00');
	const dates: string[] = [];
	for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
		const currentDay = new Date(monday);
		currentDay.setDate(monday.getDate() + dayOffset);
		dates.push(formatDateString(currentDay));
	}
	return dates;
}

/** Format a Date object as YYYY-MM-DD string. */
function formatDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Format a date string as a human-readable day header (e.g., "Monday, Feb 3"). */
export function formatDayHeader(dateString: string): string {
	const date = new Date(dateString + 'T00:00:00');
	return date.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Format a week range for display (e.g., "Feb 3-9, 2026" or "Dec 30, 2025 - Jan 5, 2026").
 */
export function formatWeekRange(mondayDateString: string): string {
	const monday = new Date(mondayDateString + 'T00:00:00');
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);

	const mondayMonth = monday.toLocaleDateString('en-US', { month: 'short' });
	const sundayMonth = sunday.toLocaleDateString('en-US', { month: 'short' });

	if (monday.getFullYear() !== sunday.getFullYear()) {
		// Cross-year boundary
		return `${mondayMonth} ${monday.getDate()}, ${monday.getFullYear()} - ${sundayMonth} ${sunday.getDate()}, ${sunday.getFullYear()}`;
	}

	if (monday.getMonth() === sunday.getMonth()) {
		// Same month
		return `${mondayMonth} ${monday.getDate()}-${sunday.getDate()}, ${monday.getFullYear()}`;
	}

	// Different months, same year
	return `${mondayMonth} ${monday.getDate()} - ${sundayMonth} ${sunday.getDate()}, ${monday.getFullYear()}`;
}

/** Format minutes as hours string (e.g., 450 -> "7.5 hrs"). */
export function formatHoursFromMinutes(totalMinutes: number): string {
	const hours = totalMinutes / 60;
	// Round to 1 decimal place
	const rounded = Math.round(hours * 10) / 10;
	return `${rounded} hrs`;
}

/** Format a time string (HH:MM:SS) as short form (HH:MM). */
export function formatTimeShort(timeString: string | null): string {
	if (!timeString) return '--:--';
	return timeString.substring(0, 5);
}

/** Get the ordinal suffix for a day number (e.g., 1 → "st", 2 → "nd", 3 → "rd", 4 → "th"). */
export function getOrdinalSuffix(day: number): string {
	if (day >= 11 && day <= 13) return 'th';
	switch (day % 10) {
		case 1:
			return 'st';
		case 2:
			return 'nd';
		case 3:
			return 'rd';
		default:
			return 'th';
	}
}

/** Format a Monday date string as short label (e.g., "Monday 9th Feb"). */
export function formatWeekStartShort(mondayDateString: string): string {
	const date = new Date(mondayDateString + 'T00:00:00');
	const dayOfMonth = date.getDate();
	const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
	const month = date.toLocaleDateString('en-US', { month: 'short' });
	return `${weekday} ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)} ${month}`;
}

/** Format a Monday date string as full week label (e.g., "Week Starting Monday 9th Feb"). */
export function formatWeekStartLabel(mondayDateString: string): string {
	return `Week Starting ${formatWeekStartShort(mondayDateString)}`;
}

/** Format minutes as duration string (e.g., 90 -> "1h 30m"). */
export function formatDuration(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0 && minutes > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (hours > 0) {
		return `${hours}h`;
	}
	return `${minutes}m`;
}
