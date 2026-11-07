/**
 * Moving a running timer's start (sprint 041-CL) and the entries its run could overlap; moving a
 * stopped timer's start and resuming a stopped timer (sprint 056-DR).
 * The rules themselves are in `src/routes/api/timer/timer-start-rules.ts`.
 */
import { and, between, eq, isNotNull, isNull } from 'drizzle-orm';
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

const decryptRow = (row: typeof timeEntries.$inferSelect) => ({
	...row,
	description: decryptNullable(row.description, 'time_entries.description')
});

/** Only a stopped draft: `end_time` is set and `is_draft` still true. */
const stoppedDraft = (entryId: string, userId: string) =>
	and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId), eq(timeEntries.isDraft, true), isNotNull(timeEntries.endTime));

/**
 * Move a stopped timer's start, keeping its end; `durationMinutes` is re-measured by the caller
 * (`calculateTimerDurationMinutes`). Null when there is no such stopped draft.
 */
export async function moveStoppedTimerStart(
	entryId: string,
	userId: string,
	start: { date: string; startTime: string; durationMinutes: number }
) {
	const results = await database
		.update(timeEntries)
		.set({ date: start.date, startTime: start.startTime, durationMinutes: start.durationMinutes, updatedAt: new Date() })
		.where(stoppedDraft(entryId, userId))
		.returning();
	return results[0] ? decryptRow(results[0]) : null;
}

/**
 * Resume a stopped timer from `start` (its own start, or a new one): the end is cleared, so the
 * timer runs from there through now, time spent editing included (design r1 SP-05).
 */
export async function resumeStoppedTimer(entryId: string, userId: string, start: { date: string; startTime: string }) {
	const results = await database
		.update(timeEntries)
		.set({ date: start.date, startTime: start.startTime, endTime: null, durationMinutes: 0, updatedAt: new Date() })
		.where(stoppedDraft(entryId, userId))
		.returning();
	return results[0] ? decryptRow(results[0]) : null;
}
