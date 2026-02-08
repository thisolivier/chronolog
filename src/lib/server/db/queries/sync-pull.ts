/**
 * Sync pull queries: fetches all entities changed since a given timestamp for a user.
 *
 * For tables with updatedAt (clients, contracts, deliverables, timeEntries, notes, weeklyStatuses):
 *   - Filters by updatedAt > since
 *
 * For tables without updatedAt (workTypes, noteLinks, noteTimeEntries, attachments):
 *   - workTypes: pull all (small dataset, no timestamps)
 *   - noteLinks: filter by createdAt > since (or all)
 *   - noteTimeEntries: pull all (small join table, no timestamps)
 *   - attachments: filter by createdAt > since (or all), metadata only (no blob data)
 */
import { eq, gt, and, inArray } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { clients } from '$lib/server/db/schema/clients';
import { contracts } from '$lib/server/db/schema/contracts';
import { deliverables } from '$lib/server/db/schema/deliverables';
import { workTypes } from '$lib/server/db/schema/work-types';
import { timeEntries } from '$lib/server/db/schema/time-entries';
import { notes } from '$lib/server/db/schema/notes';
import { noteLinks } from '$lib/server/db/schema/note-links';
import { noteTimeEntries } from '$lib/server/db/schema/note-time-entries';
import { weeklyStatuses } from '$lib/server/db/schema/weekly-statuses';
import { attachments } from '$lib/server/db/schema/attachments';
import type { SyncPullResponse } from '$lib/sync/types';

/**
 * Serialize Date fields in a row to ISO strings for JSON transport.
 * Recursively converts any Date values to their ISO string representation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRow<T>(row: any): T {
	const serialized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		serialized[key] = value instanceof Date ? value.toISOString() : value;
	}
	return serialized as T;
}

/** Serialize an array of database rows, converting Date fields to ISO strings. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRows<T>(rows: any[]): T[] {
	return rows.map((row) => serializeRow<T>(row));
}

/** Pull all entities changed since `since` for the given user. If since is null, returns everything. */
export async function pullChangesSince(
	userId: string,
	since: Date | null
): Promise<SyncPullResponse> {
	const serverTimestamp = new Date();

	const [
		clientRows,
		contractRows,
		deliverableRows,
		workTypeRows,
		timeEntryRows,
		noteRows,
		noteLinkRows,
		noteTimeEntryRows,
		weeklyStatusRows,
		attachmentRows
	] = await Promise.all([
		pullClients(userId, since),
		pullContracts(userId, since),
		pullDeliverables(userId, since),
		pullWorkTypes(userId),
		pullTimeEntries(userId, since),
		pullNotes(userId, since),
		pullNoteLinks(userId, since),
		pullNoteTimeEntries(userId),
		pullWeeklyStatuses(userId, since),
		pullAttachmentMetadata(userId, since)
	]);

	return {
		clients: serializeRows(clientRows),
		contracts: serializeRows(contractRows),
		deliverables: serializeRows(deliverableRows),
		workTypes: workTypeRows, // no Date fields
		timeEntries: serializeRows(timeEntryRows),
		notes: serializeRows(noteRows),
		noteLinks: serializeRows(noteLinkRows),
		noteTimeEntries: noteTimeEntryRows, // no Date fields
		weeklyStatuses: serializeRows(weeklyStatusRows),
		attachments: serializeRows(attachmentRows),
		serverTimestamp: serverTimestamp.toISOString()
	};
}

// --- Per-table pull functions ---

async function pullClients(userId: string, since: Date | null) {
	const conditions = [eq(clients.userId, userId)];
	if (since) conditions.push(gt(clients.updatedAt, since));

	return database.select().from(clients).where(and(...conditions));
}

async function pullContracts(userId: string, since: Date | null) {
	// Contracts don't have userId directly; join through clients
	const userClientIds = database
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.userId, userId));

	const conditions = [inArray(contracts.clientId, userClientIds)];
	if (since) conditions.push(gt(contracts.updatedAt, since));

	return database.select().from(contracts).where(and(...conditions));
}

async function pullDeliverables(userId: string, since: Date | null) {
	// Deliverables: join through contracts -> clients
	const userClientIds = database
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.userId, userId));

	const userContractIds = database
		.select({ id: contracts.id })
		.from(contracts)
		.where(inArray(contracts.clientId, userClientIds));

	const conditions = [inArray(deliverables.contractId, userContractIds)];
	if (since) conditions.push(gt(deliverables.updatedAt, since));

	return database.select().from(deliverables).where(and(...conditions));
}

async function pullWorkTypes(userId: string) {
	// WorkTypes have no timestamps — always pull all via deliverables -> contracts -> clients
	const userClientIds = database
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.userId, userId));

	const userContractIds = database
		.select({ id: contracts.id })
		.from(contracts)
		.where(inArray(contracts.clientId, userClientIds));

	const userDeliverableIds = database
		.select({ id: deliverables.id })
		.from(deliverables)
		.where(inArray(deliverables.contractId, userContractIds));

	return database
		.select()
		.from(workTypes)
		.where(inArray(workTypes.deliverableId, userDeliverableIds));
}

async function pullTimeEntries(userId: string, since: Date | null) {
	const conditions = [eq(timeEntries.userId, userId)];
	if (since) conditions.push(gt(timeEntries.updatedAt, since));

	return database.select().from(timeEntries).where(and(...conditions));
}

async function pullNotes(userId: string, since: Date | null) {
	const conditions = [eq(notes.userId, userId)];
	if (since) conditions.push(gt(notes.updatedAt, since));

	return database.select().from(notes).where(and(...conditions));
}

async function pullNoteLinks(userId: string, since: Date | null) {
	// NoteLinks: join via notes.userId for the source note
	const userNoteIds = database
		.select({ id: notes.id })
		.from(notes)
		.where(eq(notes.userId, userId));

	const conditions = [inArray(noteLinks.sourceNoteId, userNoteIds)];
	if (since) conditions.push(gt(noteLinks.createdAt, since));

	return database.select().from(noteLinks).where(and(...conditions));
}

async function pullNoteTimeEntries(userId: string) {
	// NoteTimeEntries have no timestamps — pull all via notes.userId
	const userNoteIds = database
		.select({ id: notes.id })
		.from(notes)
		.where(eq(notes.userId, userId));

	return database
		.select()
		.from(noteTimeEntries)
		.where(inArray(noteTimeEntries.noteId, userNoteIds));
}

async function pullWeeklyStatuses(userId: string, since: Date | null) {
	const conditions = [eq(weeklyStatuses.userId, userId)];
	if (since) conditions.push(gt(weeklyStatuses.updatedAt, since));

	return database.select().from(weeklyStatuses).where(and(...conditions));
}

async function pullAttachmentMetadata(userId: string, since: Date | null) {
	// Attachments: join via notes.userId, return metadata only (no blob data)
	const userNoteIds = database
		.select({ id: notes.id })
		.from(notes)
		.where(eq(notes.userId, userId));

	const conditions = [inArray(attachments.noteId, userNoteIds)];
	if (since) conditions.push(gt(attachments.createdAt, since));

	return database
		.select({
			id: attachments.id,
			noteId: attachments.noteId,
			filename: attachments.filename,
			mimeType: attachments.mimeType,
			sizeBytes: attachments.sizeBytes,
			createdAt: attachments.createdAt
		})
		.from(attachments)
		.where(and(...conditions));
}
