/**
 * Transaction-bound note writes for `POST /api/notes/batch` with `atomic: true` (sprint 038-CL).
 *
 * `createNoteForUser` and `updateNoteForUser` (notes.ts) each open their own transaction, so they
 * cannot join the batch's. These are the same writes against a given transaction: the ID is
 * allocated under the same advisory lock with the same `getNextNoteId`, the row is encrypted the
 * same way, and markdown without TipTap JSON clears `content_json` and counts words from the
 * markdown, as the CLI's PATCH does. A non-atomic batch calls the notes.ts functions directly.
 * Notes in the trash (sprint 037-CL) are invisible here as everywhere: lock and update skip them, so
 * an atomic import cannot append to a trashed note (`note_not_found`, the batch's 404).
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { clients, contracts, notes } from '$lib/server/db';
import { decryptNullable, encryptNullable } from '$lib/server/crypto/server-cipher';
import { getNextNoteId, noteIdDate, NoteConflictError, type NoteClock } from './notes';
import { calculateWordCountFromMarkdown } from './note-word-count';
import type { BatchTransaction } from '$lib/server/batch/run-batch';

type NoteRow = typeof notes.$inferSelect;

function decryptNote(row: NoteRow): NoteRow {
	return {
		...row,
		title: decryptNullable(row.title, 'notes.title'),
		content: decryptNullable(row.content, 'notes.content'),
		contentJson: decryptNullable(row.contentJson, 'notes.content_json')
	};
}

/** `createNoteForUser` inside `transaction` (markdown only; no TipTap JSON over the batch API). */
export async function createNoteInTransaction(
	transaction: BatchTransaction,
	userId: string,
	contractId: string,
	title: string | undefined,
	content: string | undefined,
	clock: NoteClock = {}
) {
	const fixedClock = { ...clock, now: clock.now ?? new Date() };
	const [contractRow] = await transaction
		.select({ shortCode: clients.shortCode })
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(eq(contracts.id, contractId))
		.limit(1);
	if (!contractRow) throw new Error('Contract not found');
	const lockKey = `note-id:${contractRow.shortCode}.${noteIdDate(fixedClock)}`;
	await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

	const noteId = await getNextNoteId(contractId, fixedClock, transaction);
	const [row] = await transaction
		.insert(notes)
		.values({
			id: noteId,
			userId,
			contractId,
			title: encryptNullable(title ?? null),
			content: encryptNullable(content ?? null),
			contentJson: null,
			// As POST /api/notes since sprint 037-CL: counted from the markdown
			wordCount: calculateWordCountFromMarkdown(content ?? ''),
			...(clock.now ? { createdAt: clock.now } : {})
		})
		.returning();
	return decryptNote(row);
}

/** The user's note, locked for the rest of the transaction; null when it is not theirs or in the trash. */
export async function lockNoteInTransaction(transaction: BatchTransaction, userId: string, noteId: string) {
	const [row] = await transaction
		.select()
		.from(notes)
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
		.for('update');
	return row ? decryptNote(row) : null;
}

/**
 * `updateNoteForUser` inside `transaction` for a note already locked with `lockNoteInTransaction`
 * (`lockedUpdatedAt` is the value read then): `expectedUpdatedAt` that no longer matches is a
 * `NoteConflictError`. `undefined` leaves a field alone.
 */
export async function updateNoteInTransaction(
	transaction: BatchTransaction,
	userId: string,
	noteId: string,
	changes: { title?: string | null; content?: string | null },
	lockedUpdatedAt: Date,
	expectedUpdatedAt?: Date
) {
	if (expectedUpdatedAt && expectedUpdatedAt.getTime() !== lockedUpdatedAt.getTime()) {
		throw new NoteConflictError(noteId, lockedUpdatedAt);
	}
	const updateData: Partial<NoteRow> & { updatedAt: Date } = { updatedAt: new Date() };
	if (changes.title !== undefined) updateData.title = encryptNullable(changes.title);
	if (changes.content !== undefined) {
		updateData.content = encryptNullable(changes.content);
		updateData.contentJson = null;
		updateData.wordCount = calculateWordCountFromMarkdown(changes.content ?? '');
	}
	const [row] = await transaction
		.update(notes)
		.set(updateData)
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
		.returning();
	return row ? decryptNote(row) : null;
}
