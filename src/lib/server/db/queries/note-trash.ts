/**
 * Server-side trash for notes (sprint 037-CL).
 *
 * Deleting a note sets `deleted_at`; the row keeps its ID, its `note_links` (both directions) and
 * its `note_time_entries`, so restoring is a single `deleted_at = null`. Every read that lists,
 * searches, titles, previews or resolves notes skips trashed rows unless asked (`includeDeleted`).
 *
 * Nothing runs on a schedule: each delete also hard-deletes that user's notes trashed more than
 * `TRASH_RETENTION_DAYS` ago, in the same transaction (the foreign keys cascade to links, time-entry
 * links and attachments). `scripts/purge-note-trash.mjs` does the same for every user, by hand.
 */
import { and, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { database, notes, contracts, clients } from '$lib/server/db';
import { decryptNullable, decryptText } from '$lib/server/crypto/server-cipher';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';

/** Days a trashed note can be restored; keep in sync with `scripts/purge-note-trash.mjs`. */
export const TRASH_RETENTION_DAYS = 30;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
type QueryExecutor = typeof database | Transaction;

/** When a note trashed at `deletedAt` is purged. */
export function trashPurgeDate(deletedAt: Date): Date {
	return new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MILLISECONDS);
}

/** Hard-deletes the user's notes trashed before `now - TRASH_RETENTION_DAYS`; returns their IDs. */
export async function purgeExpiredTrash(userId: string, now: Date = new Date(), executor: QueryExecutor = database) {
	const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MILLISECONDS);
	const purged = await executor
		.delete(notes)
		.where(and(eq(notes.userId, userId), isNotNull(notes.deletedAt), lt(notes.deletedAt, cutoff)))
		.returning({ id: notes.id });
	return purged.map((row) => row.id);
}

/**
 * Moves the user's note to the trash and purges expired trash, in one transaction. Returns the
 * trashed note's `{ id, title, contractId, deletedAt }` (title decrypted), or null when the note is
 * not the user's or is already in the trash.
 */
export async function deleteNoteForUser(userId: string, noteId: string, now: Date = new Date()) {
	return database.transaction(async (transaction) => {
		const trashed = await transaction
			.update(notes)
			.set({ deletedAt: now })
			.where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
			.returning({ id: notes.id, title: notes.title, contractId: notes.contractId, deletedAt: notes.deletedAt });
		if (trashed.length === 0) return null;
		await purgeExpiredTrash(userId, now, transaction);
		const row = trashed[0];
		return { ...row, title: decryptNullable(row.title, 'notes.title'), deletedAt: row.deletedAt as Date };
	});
}

/** The contract a note lives on, with whether it (or its client) is archived or the system bin. */
async function contractSummary(contractId: string, executor: QueryExecutor = database) {
	const rows = await executor
		.select({
			id: contracts.id,
			name: contracts.name,
			archivedAt: contracts.archivedAt,
			isSystem: contracts.isSystem,
			clientShortCode: clients.shortCode,
			clientArchivedAt: clients.archivedAt
		})
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(eq(contracts.id, contractId))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	return {
		id: row.id,
		name: decryptText(row.name, 'contracts.name'),
		clientShortCode: row.clientShortCode,
		archived: Boolean(row.archivedAt || row.clientArchivedAt),
		isSystem: row.isSystem
	};
}

/**
 * Takes the user's note out of the trash. Returns `{ id, contract }` (the contract may be archived:
 * the restore is allowed and the caller reports it), or null when the note is not the user's or is
 * not in the trash.
 */
export async function restoreNoteForUser(userId: string, noteId: string) {
	const restored = await database
		.update(notes)
		.set({ deletedAt: null })
		.where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNotNull(notes.deletedAt)))
		.returning({ id: notes.id, contractId: notes.contractId });
	if (restored.length === 0) return null;
	return { id: restored[0].id, contract: await contractSummary(restored[0].contractId) };
}

/** The user's trash, newest first: id, title, contract, deletedAt and the purge date. */
export async function listTrashedNotesForUser(userId: string) {
	const rows = await database
		.select({
			id: notes.id,
			title: notes.title,
			content: notes.content,
			contentJson: notes.contentJson,
			contractId: notes.contractId,
			deletedAt: notes.deletedAt,
			contractName: contracts.name,
			clientShortCode: clients.shortCode
		})
		.from(notes)
		.innerJoin(contracts, eq(notes.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(notes.userId, userId), isNotNull(notes.deletedAt)))
		.orderBy(desc(notes.deletedAt));
	return rows.map((row) => {
		const deletedAt = row.deletedAt as Date;
		return {
			id: row.id,
			// Stored title, else the first line (TipTap JSON, or the markdown of a CLI note)
			title:
				noteDisplayTitle(
					decryptNullable(row.title, 'notes.title'),
					decryptNullable(row.contentJson, 'notes.content_json')
				) ?? (extractMarkdownPreviewLines(decryptNullable(row.content, 'notes.content')).firstLine || null),
			contractId: row.contractId,
			contract: `${row.clientShortCode}/${decryptText(row.contractName, 'contracts.name')}`,
			deletedAt,
			purgeAt: trashPurgeDate(deletedAt)
		};
	});
}
