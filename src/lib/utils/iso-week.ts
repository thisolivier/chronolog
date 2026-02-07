/**
 * ISO week utilities.
 *
 * ISO 8601 defines weeks as starting on Monday, with week 1 being
 * the week that contains the first Thursday of the year.
 */

/** Get the ISO week number for a given date string (YYYY-MM-DD). */
export function getIsoWeekNumber(dateString: string): number {
	const date = new Date(dateString + 'T00:00:00');
	const dayOfWeek = date.getDay() || 7; // Convert Sunday=0 to 7
	// Set to nearest Thursday (current date + 4 - current day number)
	date.setDate(date.getDate() + 4 - dayOfWeek);
	const yearStart = new Date(date.getFullYear(), 0, 1);
	const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return weekNumber;
}

/** Get the ISO year for a given date string (accounts for year boundary weeks). */
export function getIsoYear(dateString: string): number {
	const date = new Date(dateString + 'T00:00:00');
	const dayOfWeek = date.getDay() || 7;
	date.setDate(date.getDate() + 4 - dayOfWeek);
	return date.getFullYear();
}

/**
 * Get the Monday (start) of the ISO week for a given year and week number.
 * Returns a date string in YYYY-MM-DD format.
 */
export function getMondayOfIsoWeek(year: number, weekNumber: number): string {
	// January 4th is always in week 1
	const january4th = new Date(year, 0, 4);
	const dayOfWeek = january4th.getDay() || 7; // Convert Sunday=0 to 7
	// Monday of week 1
	const mondayOfWeek1 = new Date(january4th);
	mondayOfWeek1.setDate(january4th.getDate() - (dayOfWeek - 1));
	// Add (weekNumber - 1) * 7 days
	const targetMonday = new Date(mondayOfWeek1);
	targetMonday.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);
	return formatDateString(targetMonday);
}

/** Get the Monday of the week containing the given date string. */
export function getMondayOfWeek(dateString: string): string {
	const date = new Date(dateString + 'T00:00:00');
	const dayOfWeek = date.getDay() || 7; // Convert Sunday=0 to 7
	const monday = new Date(date);
	monday.setDate(date.getDate() - (dayOfWeek - 1));
	return formatDateString(monday);
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
