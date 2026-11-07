/**
 * Labels for the time review (sprint 057-DR, TR-01 / TR-02): the week heading and the day
 * headings, in the day-month order of the design ("2–8 Nov 2026", "Thursday, 5 November").
 * Week numbers are ISO 8601 (iso-week.ts), so a 53-week year shows Week 53.
 */
import { isoWeekNumber, shiftWeek } from '$lib/utils/iso-week';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(dateString: string) {
	const [year, month, day] = dateString.split('-').map(Number);
	const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
	return { year, monthIndex: month - 1, day, weekday };
}

/** "2–8 Nov 2026", "26 Oct – 1 Nov 2026", "28 Dec 2026 – 3 Jan 2027" */
export function formatWeekSpan(weekStart: string): string {
	const monday = parts(weekStart);
	const sunday = parts(addDays(weekStart, 6));
	if (monday.year !== sunday.year) {
		return `${monday.day} ${MONTHS_SHORT[monday.monthIndex]} ${monday.year} – ${sunday.day} ${MONTHS_SHORT[sunday.monthIndex]} ${sunday.year}`;
	}
	if (monday.monthIndex !== sunday.monthIndex) {
		return `${monday.day} ${MONTHS_SHORT[monday.monthIndex]} – ${sunday.day} ${MONTHS_SHORT[sunday.monthIndex]} ${sunday.year}`;
	}
	return `${monday.day}–${sunday.day} ${MONTHS_SHORT[monday.monthIndex]} ${monday.year}`;
}

/** "Week 45 · 2–8 Nov 2026" */
export function formatWeekHeading(weekStart: string): string {
	return `Week ${isoWeekNumber(weekStart)} · ${formatWeekSpan(weekStart)}`;
}

/** Number of the week before / after, for the ‹ › buttons (no wrap at 52: 2027 Week 1 follows 2026 Week 52) */
export function neighbourWeekNumbers(weekStart: string): { previous: number; next: number } {
	return {
		previous: isoWeekNumber(shiftWeek(weekStart, -1)),
		next: isoWeekNumber(shiftWeek(weekStart, 1))
	};
}

/** Day heading: "Thursday, 5 November" (wide) or "Thu, 5 Nov" (narrow) */
export function formatDayHeading(dateString: string, width: 'long' | 'short' = 'long'): string {
	const { day, monthIndex, weekday } = parts(dateString);
	return width === 'long'
		? `${WEEKDAYS_LONG[weekday]}, ${day} ${MONTHS_LONG[monthIndex]}`
		: `${WEEKDAYS_SHORT[weekday]}, ${day} ${MONTHS_SHORT[monthIndex]}`;
}

/** Week strip cell: "Mon 2" */
export function formatStripDay(dateString: string): string {
	const { day, weekday } = parts(dateString);
	return `${WEEKDAYS_SHORT[weekday]} ${day}`;
}

function addDays(dateString: string, days: number): string {
	const { year, monthIndex, day } = parts(dateString);
	return new Date(Date.UTC(year, monthIndex, day + days)).toISOString().slice(0, 10);
}
