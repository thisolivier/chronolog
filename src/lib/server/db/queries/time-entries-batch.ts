/**
 * Transaction-bound time-entry writes for `POST /api/time-entries/batch` with `atomic: true`
 * (sprint 038-CL): the same insert as `createTimeEntry` (time-entries.ts) and the same link rows as
 * `linkTimeEntryToNote` (notes.ts), against the batch's transaction. A link to a note that does
 * not exist is skipped (the single route ignores that failure; inside a transaction a failed
 * insert would abort everything). A non-atomic batch calls the usual functions directly.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { noteTimeEntries, notes, timeEntries } from '$lib/server/db';
import { decryptNullable, encryptNullable } from '$lib/server/crypto/server-cipher';
import type { BatchTransaction } from '$lib/server/batch/run-batch';

export type NewTimeEntry = {
	userId: string;
	contractId: string;
	deliverableId: string | null;
	workTypeId: string | null;
	date: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
	description: string | null;
};

export async function createTimeEntryInTransaction(transaction: BatchTransaction, data: NewTimeEntry) {
	const [row] = await transaction
		.insert(timeEntries)
		.values({ ...data, isDraft: false, description: encryptNullable(data.description) })
		.returning();
	return { ...row, description: decryptNullable(row.description, 'time_entries.description') };
}

/** The user's note id when it exists (the `noteId` check of `POST /api/time-entries`), else null. */
export async function findUserNoteIdInTransaction(transaction: BatchTransaction, userId: string, noteId: string) {
	const [row] = await transaction
		.select({ id: notes.id })
		.from(notes)
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
		.limit(1);
	return row?.id ?? null;
}

/** Links the entry to each existing note of `links`; unknown note ids are left out. */
export async function linkTimeEntryToNotesInTransaction(
	transaction: BatchTransaction,
	timeEntryId: string,
	links: Array<{ noteId: string; headingAnchor?: string | null }>
) {
	if (links.length === 0) return;
	const existing = await transaction
		.select({ id: notes.id })
		.from(notes)
		.where(inArray(notes.id, links.map((link) => link.noteId)));
	const existingIds = new Set(existing.map((row) => row.id));
	const rows = links
		.filter((link) => existingIds.has(link.noteId))
		.map((link) => ({ noteId: link.noteId, timeEntryId, headingAnchor: link.headingAnchor ?? null }));
	if (rows.length > 0) await transaction.insert(noteTimeEntries).values(rows).onConflictDoNothing();
}
