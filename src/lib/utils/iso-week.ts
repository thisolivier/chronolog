/**
 * Week date utilities: Mondays, the seven dates of a week and display formats.
 *
 * Week NUMBERS are not computed here: they follow Chronolog's own rule (Week 1 contains
 * 1 January, owner decision 2026-11-07) in `calendar-week.ts`. The file keeps its old name
 * because many modules import its formatters.
 */
import { mondayOnOrBefore } from './calendar-week';

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
