/**
 * Sync push queries: applies a batch of entity mutations from the client.
 *
 * Conflict resolution: last-write-wins based on clientUpdatedAt vs server's updatedAt.
 * - If server entity is newer than clientUpdatedAt, skip (conflict).
 * - If client is newer or entity doesn't exist, apply the upsert.
 * - Deletes are applied if the entity exists.
 *
 * @see sync-push-join-tables.ts for noteLinks, noteTimeEntries, and attachments handlers
 */
import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { clients } from '$lib/server/db/schema/clients';
import { contracts } from '$lib/server/db/schema/contracts';
import { deliverables } from '$lib/server/db/schema/deliverables';
import { workTypes } from '$lib/server/db/schema/work-types';
import { timeEntries } from '$lib/server/db/schema/time-entries';
import { notes } from '$lib/server/db/schema/notes';
import { weeklyStatuses } from '$lib/server/db/schema/weekly-statuses';
import type { SyncMutation, SyncPushRequest, SyncPushResponse } from '$lib/sync/types';
import {
	pushNoteLinkChanges,
	pushNoteTimeEntryChanges,
	pushAttachmentChanges
} from './sync-push-join-tables';

/** Table configuration for the push handler */
interface TableConfig {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	drizzleTable: any;
	idField: string;
	hasUpdatedAt: boolean;
	/** Columns that should never be set by the client (e.g., userId for security) */
	protectedColumns?: string[];
}

const TABLE_CONFIGS: Record<string, TableConfig> = {
	clients: {
		drizzleTable: clients,
		idField: 'id',
		hasUpdatedAt: true,
		protectedColumns: ['userId']
	},
	contracts: {
		drizzleTable: contracts,
		idField: 'id',
		hasUpdatedAt: true
	},
	deliverables: {
		drizzleTable: deliverables,
		idField: 'id',
		hasUpdatedAt: true
	},
	workTypes: {
		drizzleTable: workTypes,
		idField: 'id',
		hasUpdatedAt: false
	},
	timeEntries: {
		drizzleTable: timeEntries,
		idField: 'id',
		hasUpdatedAt: true,
		protectedColumns: ['userId']
	},
	notes: {
		drizzleTable: notes,
		idField: 'id',
		hasUpdatedAt: true,
		protectedColumns: ['userId']
	},
	weeklyStatuses: {
		drizzleTable: weeklyStatuses,
		idField: 'id',
		hasUpdatedAt: true,
		protectedColumns: ['userId']
	}
};

/** Apply a batch of client mutations, returning applied/conflict counts. */
export async function pushChanges(
	userId: string,
	request: SyncPushRequest
): Promise<SyncPushResponse> {
	const serverTimestamp = new Date();
	let totalApplied = 0;
	let totalConflicts = 0;

	for (const [tableName, mutations] of Object.entries(request.changes)) {
		if (!mutations || mutations.length === 0) continue;

		const result = await pushTableChanges(userId, tableName, mutations);
		totalApplied += result.applied;
		totalConflicts += result.conflicts;
	}

	return {
		applied: totalApplied,
		conflicts: totalConflicts,
		serverTimestamp: serverTimestamp.toISOString()
	};
}

/** Process mutations for a specific table. */
async function pushTableChanges(
	userId: string,
	tableName: string,
	mutations: SyncMutation[]
): Promise<{ applied: number; conflicts: number }> {
	// Handle join tables separately (composite keys, no updatedAt)
	if (tableName === 'noteLinks') return pushNoteLinkChanges(userId, mutations);
	if (tableName === 'noteTimeEntries') return pushNoteTimeEntryChanges(userId, mutations);
	if (tableName === 'attachments') return pushAttachmentChanges(userId, mutations);

	const config = TABLE_CONFIGS[tableName];
	if (!config) return { applied: 0, conflicts: 0 };

	let applied = 0;
	let conflicts = 0;

	for (const mutation of mutations) {
		const result = await applyMutation(userId, config, mutation);
		if (result === 'applied') applied++;
		else if (result === 'conflict') conflicts++;
	}

	return { applied, conflicts };
}

/** Apply a single mutation with last-write-wins conflict resolution. */
async function applyMutation(
	userId: string,
	config: TableConfig,
	mutation: SyncMutation
): Promise<'applied' | 'conflict' | 'skipped'> {
	const entityId = mutation.data[config.idField] as string;
	if (!entityId) return 'skipped';

	if (mutation.operation === 'delete') {
		return applyDelete(config, entityId);
	}

	return applyUpsert(userId, config, mutation);
}

async function applyDelete(
	config: TableConfig,
	entityId: string
): Promise<'applied' | 'conflict' | 'skipped'> {
	const idColumn = config.drizzleTable[config.idField];
	const result = await database
		.delete(config.drizzleTable)
		.where(eq(idColumn, entityId))
		.returning({ id: idColumn });

	return result.length > 0 ? 'applied' : 'skipped';
}

async function applyUpsert(
	userId: string,
	config: TableConfig,
	mutation: SyncMutation
): Promise<'applied' | 'conflict' | 'skipped'> {
	const entityId = mutation.data[config.idField] as string;
	const idColumn = config.drizzleTable[config.idField];

	// Check if entity exists on server
	const existing = await database
		.select()
		.from(config.drizzleTable)
		.where(eq(idColumn, entityId))
		.limit(1);

	if (existing.length > 0 && config.hasUpdatedAt && mutation.clientUpdatedAt) {
		const serverUpdatedAt = new Date(existing[0].updatedAt);
		const clientUpdatedAt = new Date(mutation.clientUpdatedAt);

		// Last-write-wins: if server is newer, this is a conflict
		if (serverUpdatedAt > clientUpdatedAt) {
			return 'conflict';
		}
	}

	// Build the data payload, enforcing protected columns
	const entityData = { ...mutation.data };

	// Enforce userId on tables that have it (security: client can't push data for other users)
	if (config.protectedColumns?.includes('userId')) {
		entityData.userId = userId;
	}

	// Set updatedAt to now for tables that have it
	if (config.hasUpdatedAt) {
		entityData.updatedAt = new Date();
	}

	if (existing.length > 0) {
		// Update existing entity
		await database
			.update(config.drizzleTable)
			.set(entityData)
			.where(eq(idColumn, entityId));
	} else {
		// Insert new entity
		await database.insert(config.drizzleTable).values(entityData);
	}

	return 'applied';
}
