/**
 * Weekly status (Unsubmitted / Draft ready / Submitted): recordkeeping only, nothing is sent.
 *
 * A week is identified by its Monday (`week_start`). `year` and `week_number` are stored too
 * (and carry the table's unique key), as ISO 8601 numbers (iso-week.ts). Between 057-DR and 061-DR
 * (v1.5.0, 2026-11-07) they were numbered by a "Week 1 contains 1 January" rule, which agrees with
 * ISO for every week up to 21 Dec 2026, so every row stored then already carries its ISO number.
 * Lookups go by `week_start` regardless, and a write first renumbers any row whose stored numbers
 * are not its Monday's ISO week (a no-op for every row today; it guards the unique key against a
 * v1.5.0 client writing a later week). It reads the user's rows once and writes only stale ones.
 * The old validation also let one Monday be stored twice (e.g. `2025-W53` rolled over to
 * 2025-12-29, which is also `2026-W01`): reads take the most recently updated row, and a write
 * first keeps that row and deletes the others for the same Monday.
 */
import { eq, and, desc, inArray } from 'drizzle-orm';
import { database, weeklyStatuses } from '$lib/server/db';
import { isoWeekOf } from '$lib/utils/iso-week';

export type WeeklyStatus = typeof weeklyStatuses.$inferSelect;

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

/** The status row for the week starting on `weekStart` (a Monday, `YYYY-MM-DD`) */
export async function getWeeklyStatusForWeekStart(userId: string, weekStart: string): Promise<WeeklyStatus | null> {
	const results = await database
		.select()
		.from(weeklyStatuses)
		.where(and(eq(weeklyStatuses.userId, userId), eq(weeklyStatuses.weekStart, weekStart)))
		.orderBy(desc(weeklyStatuses.updatedAt))
		.limit(1);
	return results[0] ?? null;
}

/**
 * Make the user's rows one per Monday, numbered by their ISO week. Rows sharing a Monday (a
 * legacy duplicate) keep the most recently updated one; the others are deleted and logged. Then
 * stale numbers are rewritten in two passes (negative numbers first) so renumbering a run of weeks
 * never trips the (user, year, week_number) unique key.
 */
export async function normaliseWeeklyStatusRows(transaction: Transaction, userId: string): Promise<void> {
	const rows = await transaction.select().from(weeklyStatuses).where(eq(weeklyStatuses.userId, userId));
	const newestByMonday = new Map<string, WeeklyStatus>();
	const duplicates: WeeklyStatus[] = [];
	for (const row of rows) {
		const monday = isoWeekOf(row.weekStart).weekStart;
		const kept = newestByMonday.get(monday);
		if (!kept) {
			newestByMonday.set(monday, row);
		} else if (row.updatedAt.getTime() > kept.updatedAt.getTime()) {
			duplicates.push(kept);
			newestByMonday.set(monday, row);
		} else {
			duplicates.push(row);
		}
	}
	if (duplicates.length > 0) {
		console.warn(
			`weekly_statuses: user ${userId} had ${duplicates.length} duplicate row(s) for one Monday; kept the newest, deleted`,
			duplicates.map((row) => ({ id: row.id, weekStart: row.weekStart, year: row.year, weekNumber: row.weekNumber, status: row.status }))
		);
		await transaction.delete(weeklyStatuses).where(inArray(weeklyStatuses.id, duplicates.map((row) => row.id)));
	}

	const staleRows = [...newestByMonday.entries()]
		.map(([monday, row]) => ({ row, week: isoWeekOf(monday) }))
		.filter(({ row, week }) => row.year !== week.year || row.weekNumber !== week.weekNumber || row.weekStart !== week.weekStart);
	if (staleRows.length === 0) return;
	for (const { row } of staleRows) {
		await transaction.update(weeklyStatuses).set({ weekNumber: -Math.abs(row.weekNumber) }).where(eq(weeklyStatuses.id, row.id));
	}
	for (const { row, week } of staleRows) {
		await transaction
			.update(weeklyStatuses)
			.set({ year: week.year, weekNumber: week.weekNumber, weekStart: week.weekStart })
			.where(eq(weeklyStatuses.id, row.id));
	}
}

/** Create or update the status of the week starting on `weekStart` */
export async function upsertWeeklyStatus(userId: string, weekStart: string, status: string): Promise<WeeklyStatus> {
	const week = isoWeekOf(weekStart);
	return database.transaction(async (transaction) => {
		await normaliseWeeklyStatusRows(transaction, userId);
		const existing = await transaction
			.select()
			.from(weeklyStatuses)
			.where(and(eq(weeklyStatuses.userId, userId), eq(weeklyStatuses.weekStart, week.weekStart)))
			.orderBy(desc(weeklyStatuses.updatedAt))
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
