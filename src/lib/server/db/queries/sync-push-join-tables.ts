/**
 * Sync push handlers for join tables (composite keys, no conflict resolution).
 *
 * These tables (noteLinks, noteTimeEntries, attachments) don't have updatedAt fields
 * and use composite primary keys, so they need special handling different from
 * the standard entity tables.
 */
import { eq, and } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { notes } from '$lib/server/db/schema/notes';
import { noteLinks } from '$lib/server/db/schema/note-links';
import { noteTimeEntries } from '$lib/server/db/schema/note-time-entries';
import { attachments } from '$lib/server/db/schema/attachments';
import type { SyncMutation } from '$lib/sync/types';

/** Fetches the user's note IDs for ownership verification. */
async function getUserNoteIdSet(userId: string): Promise<Set<string>> {
	const userNoteRows = await database
		.select({ id: notes.id })
		.from(notes)
		.where(eq(notes.userId, userId));
	return new Set(userNoteRows.map((row) => row.id));
}

/** Push mutations for the noteLinks join table. */
export async function pushNoteLinkChanges(
	userId: string,
	mutations: SyncMutation[]
): Promise<{ applied: number; conflicts: number }> {
	const userNoteIdSet = await getUserNoteIdSet(userId);

	let applied = 0;
	for (const mutation of mutations) {
		const sourceNoteId = mutation.data.sourceNoteId as string;
		if (!sourceNoteId || !userNoteIdSet.has(sourceNoteId)) continue;

		const targetNoteId = mutation.data.targetNoteId as string;
		if (!targetNoteId) continue;

		if (mutation.operation === 'delete') {
			const result = await database
				.delete(noteLinks)
				.where(
					and(
						eq(noteLinks.sourceNoteId, sourceNoteId),
						eq(noteLinks.targetNoteId, targetNoteId)
					)
				)
				.returning({ sourceNoteId: noteLinks.sourceNoteId });
			if (result.length > 0) applied++;
		} else {
			await database
				.insert(noteLinks)
				.values({
					sourceNoteId,
					targetNoteId,
					headingAnchor: (mutation.data.headingAnchor as string) ?? null
				})
				.onConflictDoNothing();
			applied++;
		}
	}

	return { applied, conflicts: 0 };
}

/** Push mutations for the noteTimeEntries join table. */
export async function pushNoteTimeEntryChanges(
	userId: string,
	mutations: SyncMutation[]
): Promise<{ applied: number; conflicts: number }> {
	const userNoteIdSet = await getUserNoteIdSet(userId);

	let applied = 0;
	for (const mutation of mutations) {
		const noteId = mutation.data.noteId as string;
		if (!noteId || !userNoteIdSet.has(noteId)) continue;

		const timeEntryId = mutation.data.timeEntryId as string;
		if (!timeEntryId) continue;

		if (mutation.operation === 'delete') {
			const result = await database
				.delete(noteTimeEntries)
				.where(
					and(
						eq(noteTimeEntries.noteId, noteId),
						eq(noteTimeEntries.timeEntryId, timeEntryId)
					)
				)
				.returning({ noteId: noteTimeEntries.noteId });
			if (result.length > 0) applied++;
		} else {
			await database
				.insert(noteTimeEntries)
				.values({
					noteId,
					timeEntryId,
					headingAnchor: (mutation.data.headingAnchor as string) ?? null
				})
				.onConflictDoNothing();
			applied++;
		}
	}

	return { applied, conflicts: 0 };
}

/** Push mutations for the attachments table (delete only via sync; uploads use dedicated API). */
export async function pushAttachmentChanges(
	userId: string,
	mutations: SyncMutation[]
): Promise<{ applied: number; conflicts: number }> {
	const userNoteIdSet = await getUserNoteIdSet(userId);

	let applied = 0;
	for (const mutation of mutations) {
		if (mutation.operation === 'delete') {
			const attachmentId = mutation.data.id as string;
			if (!attachmentId) continue;

			// Verify the attachment belongs to a user's note before deleting
			const attachmentRows = await database
				.select({ noteId: attachments.noteId })
				.from(attachments)
				.where(eq(attachments.id, attachmentId))
				.limit(1);

			if (attachmentRows.length > 0 && userNoteIdSet.has(attachmentRows[0].noteId)) {
				await database.delete(attachments).where(eq(attachments.id, attachmentId));
				applied++;
			}
		}
		// Note: upsert for attachments is not supported via sync push
		// (blob data must be uploaded via the dedicated attachment API)
	}

	return { applied, conflicts: 0 };
}
