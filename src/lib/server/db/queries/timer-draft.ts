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
import { isSplitRemainder, momentMatches, type ExpectedMoment } from './timer-draft-rules';

type TimeEntryRow = typeof timeEntries.$inferSelect;
/** The start the client shows, as sent (`HH:MM` or `HH:MM:SS`; compared at that precision). */
export type DraftStart = ExpectedMoment;

export type DraftRefusal = {
	ok: false;
	status: 404 | 409;
	code: 'not_found' | 'not_a_draft' | 'timer_changed' | 'expected_start_required';
	message: string;
};

/** Locks the user's entry `entryId` for the rest of the transaction; null when there is none. */
export async function lockUserEntry(transaction: BatchTransaction, entryId: string, userId: string): Promise<TimeEntryRow | null> {
	const [row] = await transaction
		.select()
		.from(timeEntries)
		.where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
		.for('update');
	return row ?? null;
}

/**
 * Why `row` is not the draft the caller expects, or null when it is. `requireExpectedStart`: the
 * caller must say which start it saw (a split remainder, or a save that overrides the times), so a
 * device that missed a split cannot log the split-off time twice or delete the remainder.
 */
export function draftRefusal(
	row: TimeEntryRow | null,
	expectedStart?: DraftStart | null,
	requireExpectedStart = false
): DraftRefusal | null {
	if (!row) return { ok: false, status: 404, code: 'not_found', message: 'Time entry not found' };
	if (!row.isDraft) {
		return { ok: false, status: 409, code: 'not_a_draft', message: 'This timer was already saved or discarded, perhaps on another device' };
	}
	if (!expectedStart && (requireExpectedStart || isSplitRemainder(row))) {
		return {
			ok: false,
			status: 409,
			code: 'expected_start_required',
			message: 'This timer may have changed on another device (split or edited); reload it and try again'
		};
	}
	if (expectedStart && !momentMatches({ date: row.date, time: row.startTime }, expectedStart)) {
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

/**
 * Turns the draft into a saved entry and links its description's notes. Time overrides
 * (`durationMinutes`, `startTime`, `endTime`) need `expectedStart`, as does a split remainder.
 */
export async function saveDraftTimer(
	entryId: string,
	userId: string,
	values: DraftSaveValues,
	expectedStart?: DraftStart | null
): Promise<{ ok: true; entry: TimeEntryRow } | DraftRefusal> {
	return database.transaction(async (transaction) => {
		const overridesTimes = values.durationMinutes !== undefined || values.startTime !== undefined || values.endTime !== undefined;
		const refusal = draftRefusal(await lockUserEntry(transaction, entryId, userId), expectedStart, overridesTimes);
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

/** Deletes the draft (its note links go with it). A split remainder needs `expectedStart`. */
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
