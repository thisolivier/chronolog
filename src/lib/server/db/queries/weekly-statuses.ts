/**
 * Weekly status (Unsubmitted / Draft ready / Submitted): recordkeeping only, nothing is sent.
 *
 * A week is identified by its Monday (`week_start`). `year` and `week_number` are stored too
 * (and carry the table's unique key), numbered by Chronolog's rule (calendar-week.ts: Week 1
 * contains 1 January). Rows written before that rule (2026-11-07) carry ISO numbers, which differ
 * for years that start on a Friday, Saturday or Sunday; lookups go by `week_start`, so no status
 * is lost, and a write first renumbers any such row so the unique key cannot collide.
 */
import { eq, and } from 'drizzle-orm';
import { database, weeklyStatuses } from '$lib/server/db';
import { calendarWeekOf } from '$lib/utils/calendar-week';

export type WeeklyStatus = typeof weeklyStatuses.$inferSelect;

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

/** The status row for the week starting on `weekStart` (a Monday, `YYYY-MM-DD`) */
export async function getWeeklyStatusForWeekStart(userId: string, weekStart: string): Promise<WeeklyStatus | null> {
	const results = await database
		.select()
		.from(weeklyStatuses)
		.where(and(eq(weeklyStatuses.userId, userId), eq(weeklyStatuses.weekStart, weekStart)))
		.limit(1);
	return results[0] ?? null;
}

/**
 * Give every row of the user the year / week number of its Monday under the current rule. Two
 * passes (negative numbers first) so renumbering a run of weeks never trips the unique key.
 */
async function renumberStaleRows(transaction: Transaction, userId: string): Promise<void> {
	const rows = await transaction.select().from(weeklyStatuses).where(eq(weeklyStatuses.userId, userId));
	const staleRows = rows
		.map((row) => ({ row, week: calendarWeekOf(row.weekStart) }))
		.filter(({ row, week }) => row.year !== week.year || row.weekNumber !== week.weekNumber);
	if (staleRows.length === 0) return;
	for (const { row } of staleRows) {
		await transaction.update(weeklyStatuses).set({ weekNumber: -row.weekNumber }).where(eq(weeklyStatuses.id, row.id));
	}
	for (const { row, week } of staleRows) {
		await transaction
			.update(weeklyStatuses)
			.set({ year: week.year, weekNumber: week.weekNumber })
			.where(eq(weeklyStatuses.id, row.id));
	}
}

/** Create or update the status of the week starting on `weekStart` */
export async function upsertWeeklyStatus(userId: string, weekStart: string, status: string): Promise<WeeklyStatus> {
	const week = calendarWeekOf(weekStart);
	return database.transaction(async (transaction) => {
		await renumberStaleRows(transaction, userId);
		const existing = await transaction
			.select()
			.from(weeklyStatuses)
			.where(and(eq(weeklyStatuses.userId, userId), eq(weeklyStatuses.weekStart, week.weekStart)))
			.limit(1);
		if (existing[0]) {
			const updated = await transaction
				.update(weeklyStatuses)
				.set({ status, updatedAt: new Date() })
				.where(eq(weeklyStatuses.id, existing[0].id))
				.returning();
			return updated[0];
		}
		const inserted = await transaction
			.insert(weeklyStatuses)
			.values({ userId, year: week.year, weekNumber: week.weekNumber, weekStart: week.weekStart, status })
			.returning();
		return inserted[0];
	});
}
