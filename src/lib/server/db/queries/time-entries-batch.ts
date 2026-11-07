/**
 * Transaction-bound time-entry writes for `POST /api/time-entries/batch` with `atomic: true`
 * (sprint 038-CL): the same insert as `createTimeEntry` (time-entries.ts) and the same link rows as
 * `linkTimeEntryToNote` (notes.ts), against the batch's transaction. A link to a note that does
 * not exist is skipped (the single route ignores that failure; inside a transaction a failed
 * insert would abort everything). A non-atomic batch calls the usual functions directly. A note in
 * the trash (sprint 037-CL) counts as not existing for both the `noteId` check and the links.
 *
 * `reconcileTimeEntryLinksInTransaction` (sprint 056-DR) is the one "description `[[links]]` →
 * `note_time_entries`" sync for an existing entry: `PUT /api/time-entries/[id]`, timer save and
 * the timer split all call it.
 */

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { extractDescriptionLinks, reconcileLinks } from '$lib/utils/reconcile-description-links';
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

/** The user's note id when it exists and is not in the trash (the `noteId` check of `POST /api/time-entries`), else null. */
export async function findUserNoteIdInTransaction(transaction: BatchTransaction, userId: string, noteId: string) {
	const [row] = await transaction
		.select({ id: notes.id })
		.from(notes)
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
		.limit(1);
	return row?.id ?? null;
}

/** Links the entry to each existing note of `links`; unknown and trashed note ids are left out. */
export async function linkTimeEntryToNotesInTransaction(
	transaction: BatchTransaction,
	timeEntryId: string,
	links: Array<{ noteId: string; headingAnchor?: string | null }>
) {
	if (links.length === 0) return;
	const existing = await transaction
		.select({ id: notes.id })
		.from(notes)
		.where(and(inArray(notes.id, links.map((link) => link.noteId)), isNull(notes.deletedAt)));
	const existingIds = new Set(existing.map((row) => row.id));
	const rows = links
		.filter((link) => existingIds.has(link.noteId))
		.map((link) => ({ noteId: link.noteId, timeEntryId, headingAnchor: link.headingAnchor ?? null }));
	if (rows.length > 0) await transaction.insert(noteTimeEntries).values(rows).onConflictDoNothing();
}

/**
 * Makes the entry's note links match the `[[links]]` in `description`: adds the missing ones
 * (skipping unknown and trashed notes) and removes those no longer mentioned.
 */
export async function reconcileTimeEntryLinksInTransaction(
	transaction: BatchTransaction,
	timeEntryId: string,
	description: string | null
) {
	const currentLinks = await transaction
		.select({ noteId: noteTimeEntries.noteId, headingAnchor: noteTimeEntries.headingAnchor })
		.from(noteTimeEntries)
		.where(eq(noteTimeEntries.timeEntryId, timeEntryId));
	const { toAdd, toRemove } = reconcileLinks(currentLinks, extractDescriptionLinks(description ?? ''));
	if (toRemove.length > 0) {
		await transaction.delete(noteTimeEntries).where(
			and(
				eq(noteTimeEntries.timeEntryId, timeEntryId),
				inArray(noteTimeEntries.noteId, toRemove.map((link) => link.noteId))
			)
		);
	}
	await linkTimeEntryToNotesInTransaction(transaction, timeEntryId, toAdd);
}
