/**
 * Calendar helpers for the CLI (pure): weeks (`2026-W45`) numbered by Chronolog's rule (Week 1 is
 * the Monday-start week containing 1 January; the same rule as src/lib/utils/calendar-week.ts,
 * owner decision 2026-11-07, not ISO 8601), and `--date` words
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

/** Monday (`YYYY-MM-DD`) that starts Week 1 of `year`: the Monday on or before 1 January */
function firstMonday(year) {
	const january1st = Date.UTC(year, 0, 1);
	const weekdayFromMonday = (new Date(january1st).getUTCDay() + 6) % 7;
	return january1st - weekdayFromMonday * DAY_MS;
}

/** 52 or 53 */
export function weeksInYear(year) {
	return Math.round((firstMonday(year + 1) - firstMonday(year)) / (7 * DAY_MS));
}

/** `2026-W45` (also `2026W45`, `2026-w5`); null when malformed or the year has no such week */
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
