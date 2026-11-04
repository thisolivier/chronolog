/**
 * Moving a running timer's start (sprint 041-CL) and the entries its run could overlap.
 * The rules themselves are in `src/routes/api/timer/timer-start-rules.ts`.
 */
import { and, between, eq, isNull } from 'drizzle-orm';
import { database, timeEntries } from '$lib/server/db';
import { decryptNullable } from '$lib/server/crypto/server-cipher';

/** The user's saved (non-draft) entries dated `fromDate`..`toDate`, with their times. */
export async function listTimedEntriesBetween(userId: string, fromDate: string, toDate: string) {
	return database
		.select({
			id: timeEntries.id,
			date: timeEntries.date,
			startTime: timeEntries.startTime,
			endTime: timeEntries.endTime
		})
		.from(timeEntries)
		.where(
			and(
				eq(timeEntries.userId, userId),
				eq(timeEntries.isDraft, false),
				between(timeEntries.date, fromDate, toDate)
			)
		);
}

/**
 * Set a running timer's local start date and time. Only a draft that has not been stopped
 * moves; returns the updated row, or null when there is no such timer.
 */
export async function moveRunningTimerStart(
	entryId: string,
	userId: string,
	start: { date: string; startTime: string }
) {
	const results = await database
		.update(timeEntries)
		.set({ date: start.date, startTime: start.startTime, updatedAt: new Date() })
		.where(
			and(
				eq(timeEntries.id, entryId),
				eq(timeEntries.userId, userId),
				eq(timeEntries.isDraft, true),
				isNull(timeEntries.endTime)
			)
		)
		.returning();
	const row = results[0];
	return row ? { ...row, description: decryptNullable(row.description, 'time_entries.description') } : null;
}
