/**
 * Calendar helpers for the CLI (pure): ISO 8601 weeks (`2026-W45`; week 1 contains the year's first
 * Thursday, so 2026-W53 is 28 Dec 2026 – 3 Jan 2027; the same rule as src/lib/utils/iso-week.ts,
 * decision 2026-11-07 "ISO 8601 after all", sprint 061-DR), and `--date` words
 * (`today`, `yesterday`, weekday names meaning the most recent such day, or YYYY-MM-DD).
 */

const DAY_MS = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toDate(dateString) {
	return new Date(`${dateString}T00:00:00Z`);
}

export function formatDate(date) {
	return date.toISOString().slice(0, 10);
}

export function addDays(dateString, days) {
	return formatDate(new Date(toDate(dateString).getTime() + days * DAY_MS));
}

/** Monday (ms since the epoch) that starts ISO week 1 of `year`: the Monday on or before 4 January */
function firstMonday(year) {
	const january4th = Date.UTC(year, 0, 4);
	const weekdayFromMonday = (new Date(january4th).getUTCDay() + 6) % 7;
	return january4th - weekdayFromMonday * DAY_MS;
}

/** 52 or 53 ISO weeks */
export function weeksInYear(year) {
	return Math.round((firstMonday(year + 1) - firstMonday(year)) / (7 * DAY_MS));
}

/** `2026-W45` (also `2026W45`, `2026-w5`); null when malformed or the ISO year has no such week (`2025-W53`) */
export function parseWeekKey(weekKey) {
	const match = String(weekKey).trim().match(/^(\d{4})-?W(\d{1,2})$/i);
	if (!match) return null;
	const year = Number(match[1]);
	const weekNumber = Number(match[2]);
	if (weekNumber < 1 || weekNumber > weeksInYear(year)) return null;
	return { year, weekNumber, key: `${year}-W${String(weekNumber).padStart(2, '0')}` };
}

/** Monday and Sunday (`YYYY-MM-DD`) of a week */
export function weekRange(year, weekNumber) {
	const monday = formatDate(new Date(firstMonday(year) + (weekNumber - 1) * 7 * DAY_MS));
	return { from: monday, to: addDays(monday, 6) };
}

/** True for a real `YYYY-MM-DD` calendar day (no 2026-02-30, which `Date` would roll into March) */
export function isCalendarDate(text) {
	const value = String(text ?? '').trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = toDate(value);
	return !Number.isNaN(date.getTime()) && formatDate(date) === value;
}

/** Resolves a `--date` word against `today` (YYYY-MM-DD in the person's timezone). */
export function resolveDateWord(word, today) {
	const value = String(word).trim().toLowerCase();
	if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDate(value).getTime())) return value;
	if (value === 'today') return today;
	if (value === 'yesterday') return addDays(today, -1);
	const weekdayIndex = WEEKDAYS.indexOf(value);
	if (weekdayIndex >= 0) {
		const todayIndex = toDate(today).getUTCDay();
		const daysBack = (todayIndex - weekdayIndex + 7) % 7;
		return addDays(today, -daysBack);
	}
	return null;
}

export function weekdayName(dateString) {
	const name = WEEKDAYS[toDate(dateString).getUTCDay()];
	return name.charAt(0).toUpperCase() + name.slice(1, 3);
}

export function formatMinutes(totalMinutes) {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours === 0) return `${minutes}m`;
	return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}m`;
}
