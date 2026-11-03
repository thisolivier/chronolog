import { listTimeEntriesForWeek, type TimeEntryWithContext } from './time-entries';
import { getWeekDates } from '$lib/utils/iso-week';

/** Time entries grouped by day, with daily total. */
export type DayGroup = {
	date: string;
	entries: TimeEntryWithContext[];
	totalMinutes: number;
};

/** Full weekly summary: entries grouped by day plus weekly total. */
export type WeeklySummary = {
	weekStart: string;
	days: DayGroup[];
	weeklyTotalMinutes: number;
};

/**
 * Get time entries for a week grouped by day, with totals.
 * Returns all 7 days (Mon-Sun), even if empty.
 */
export async function getWeeklySummary(
	userId: string,
	weekStart: string
): Promise<WeeklySummary> {
	const allEntries = await listTimeEntriesForWeek(userId, weekStart);
	const weekDates = getWeekDates(weekStart);

	// Group entries by date
	const entriesByDate = new Map<string, TimeEntryWithContext[]>();
	for (const entry of allEntries) {
		const dateEntries = entriesByDate.get(entry.date) ?? [];
		dateEntries.push(entry);
		entriesByDate.set(entry.date, dateEntries);
	}

	// Build day groups for all 7 days
	const days: DayGroup[] = weekDates.map((date) => {
		const entries = entriesByDate.get(date) ?? [];
		const totalMinutes = entries.reduce(
			(sum, entry) => sum + entry.durationMinutes,
			0
		);
		return { date, entries, totalMinutes };
	});

	const weeklyTotalMinutes = days.reduce(
		(sum, day) => sum + day.totalMinutes,
		0
	);

	return { weekStart, days, weeklyTotalMinutes };
}
