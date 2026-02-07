import { and, eq, between, sum } from 'drizzle-orm';
import { database, timeEntries } from '$lib/server/db';
import { listTimeEntriesForWeek, type TimeEntryWithContext } from './time-entries';
import { getWeekDates, getSundayOfWeek } from '$lib/utils/iso-week';

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

/**
 * Get total minutes per week for a range of weeks.
 * More efficient than calling getWeeklySummary for each week.
 * Returns a Map of weekStart (Monday YYYY-MM-DD) to total minutes.
 */
export async function getWeeklyTotals(
	userId: string,
	weekStarts: string[]
): Promise<Map<string, number>> {
	if (weekStarts.length === 0) {
		return new Map();
	}

	// Build date ranges for all weeks
	const dateRanges: { start: string; end: string; weekStart: string }[] = [];
	for (const weekStart of weekStarts) {
		const weekEnd = getSundayOfWeek(weekStart);
		dateRanges.push({ start: weekStart, end: weekEnd, weekStart });
	}

	// Query all time entries that fall within any of these weeks
	// We need to check each week individually or build a complex OR condition
	// For simplicity, we'll query the full date range and group by week
	const earliestDate = dateRanges[dateRanges.length - 1].start; // Last week (oldest)
	const latestDate = dateRanges[0].end; // First week (newest)

	const results = await database
		.select({
			date: timeEntries.date,
			totalMinutes: sum(timeEntries.durationMinutes)
		})
		.from(timeEntries)
		.where(
			and(
				eq(timeEntries.userId, userId),
				between(timeEntries.date, earliestDate, latestDate),
				eq(timeEntries.isDraft, false)
			)
		)
		.groupBy(timeEntries.date);

	// Map each date to its week start
	const totalsMap = new Map<string, number>();

	// Initialize all weeks to 0
	for (const weekStart of weekStarts) {
		totalsMap.set(weekStart, 0);
	}

	// Build a helper map from date to weekStart
	const dateToWeekStart = new Map<string, string>();
	for (const { start, end, weekStart } of dateRanges) {
		const startDate = new Date(start);
		const endDate = new Date(end);
		for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
			const dateString = date.toISOString().split('T')[0];
			dateToWeekStart.set(dateString, weekStart);
		}
	}

	// Accumulate totals by week
	for (const row of results) {
		const weekStart = dateToWeekStart.get(row.date);
		if (weekStart) {
			const currentTotal = totalsMap.get(weekStart) ?? 0;
			const minutes = typeof row.totalMinutes === 'string' ? parseInt(row.totalMinutes, 10) : (row.totalMinutes ?? 0);
			totalsMap.set(weekStart, currentTotal + minutes);
		}
	}

	return totalsMap;
}
