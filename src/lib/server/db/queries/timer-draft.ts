/**
 * Saving and discarding the draft timer (sprint 056-DR). Each runs in one transaction that locks
 * the row and checks it is still the user's draft (and, when the caller says which start it saw,
 * that the start still matches), so a stale device can no longer overwrite or delete an entry
 * that was saved elsewhere. A save also links the notes its description `[[links]]` to.
 */
import { and, eq } from 'drizzle-orm';
import { database, timeEntries } from '$lib/server/db';
import { decryptNullable, encryptNullable } from '$lib/server/crypto/server-cipher';
import type { BatchTransaction } from '$lib/server/batch/run-batch';
import { reconcileTimeEntryLinksInTransaction } from './time-entries-batch';

type TimeEntryRow = typeof timeEntries.$inferSelect;
export type DraftStart = { date: string; time: string };

export type DraftRefusal = { ok: false; status: 404 | 409; code: 'not_found' | 'not_a_draft' | 'timer_changed'; message: string };

/** Locks the user's entry `entryId` for the rest of the transaction; null when there is none. */
export async function lockUserEntry(transaction: BatchTransaction, entryId: string, userId: string): Promise<TimeEntryRow | null> {
	const [row] = await transaction
		.select()
		.from(timeEntries)
		.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
		.for('update');
	return row ?? null;
}

const fullTime = (time: string) => (time.length === 5 ? `${time}:00` : time);

/** Why `row` is not the draft the caller expects, or null when it is. */
export function draftRefusal(row: TimeEntryRow | null, expectedStart?: DraftStart | null): DraftRefusal | null {
	if (!row) return { ok: false, status: 404, code: 'not_found', message: 'Time entry not found' };
	if (!row.isDraft) {
		return { ok: false, status: 409, code: 'not_a_draft', message: 'This timer was already saved or discarded, perhaps on another device' };
	}
	if (expectedStart && (row.date !== expectedStart.date || !row.startTime || fullTime(row.startTime) !== fullTime(expectedStart.time))) {
		return { ok: false, status: 409, code: 'timer_changed', message: 'The timer changed since this screen loaded; reload it and try again' };
	}
	return null;
}

export type DraftSaveValues = {
	contractId: string;
	deliverableId: string | null;
	workTypeId: string | null;
	description: string | null;
	durationMinutes?: number;
	startTime?: string | null;
	endTime?: string | null;
};

/** Turns the draft into a saved entry and links its description's notes. */
export async function saveDraftTimer(
	entryId: string,
	userId: string,
	values: DraftSaveValues,
	expectedStart?: DraftStart | null
): Promise<{ ok: true; entry: TimeEntryRow } | DraftRefusal> {
	return database.transaction(async (transaction) => {
		const refusal = draftRefusal(await lockUserEntry(transaction, entryId, userId), expectedStart);
		if (refusal) return refusal;
		const [row] = await transaction
			.update(timeEntries)
			// clientRequestId: drop a split's remainder mark (timer-split.ts) now the draft is an entry
			.set({ ...values, description: encryptNullable(values.description), isDraft: false, clientRequestId: null, updatedAt: new Date() })
			.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
			.returning();
		await reconcileTimeEntryLinksInTransaction(transaction, entryId, values.description);
		return { ok: true as const, entry: { ...row, description: decryptNullable(row.description, 'time_entries.description') } };
	});
}

/** Deletes the draft (its note links go with it). */
export async function discardDraftTimer(
	entryId: string,
	userId: string,
	expectedStart?: DraftStart | null
): Promise<{ ok: true } | DraftRefusal> {
	return database.transaction(async (transaction) => {
		const refusal = draftRefusal(await lockUserEntry(transaction, entryId, userId), expectedStart);
		if (refusal) return refusal;
		await transaction.delete(timeEntries).where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)));
		return { ok: true as const };
	});
}
