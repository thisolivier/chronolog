/**
 * Shared types for the sync protocol between client and server.
 * These types are used by both the server API endpoints and the client sync engine.
 */

// --- Row types for each syncable table ---

export interface ClientRow {
	id: string;
	userId: string;
	name: string;
	shortCode: string;
	createdAt: string;
	updatedAt: string;
}

export interface ContractRow {
	id: string;
	clientId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface DeliverableRow {
	id: string;
	contractId: string;
	name: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface WorkTypeRow {
	id: string;
	deliverableId: string;
	name: string;
	sortOrder: number;
}

export interface TimeEntryRow {
	id: string;
	userId: string;
	contractId: string;
	deliverableId: string | null;
	workTypeId: string | null;
	date: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
	description: string | null;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface NoteRow {
	id: string;
	userId: string;
	contractId: string;
	title: string | null;
	content: string | null;
	contentJson: string | null;
	wordCount: number;
	isPinned: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface NoteLinkRow {
	sourceNoteId: string;
	targetNoteId: string;
	headingAnchor: string | null;
	createdAt: string;
}

export interface NoteTimeEntryRow {
	noteId: string;
	timeEntryId: string;
	headingAnchor: string | null;
}

export interface WeeklyStatusRow {
	id: string;
	userId: string;
	weekStart: string;
	year: number;
	weekNumber: number;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export interface AttachmentMetadataRow {
	id: string;
	noteId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
}

// --- Sync protocol types ---

export interface SyncPullResponse {
	clients: ClientRow[];
	contracts: ContractRow[];
	deliverables: DeliverableRow[];
	workTypes: WorkTypeRow[];
	timeEntries: TimeEntryRow[];
	notes: NoteRow[];
	noteLinks: NoteLinkRow[];
	noteTimeEntries: NoteTimeEntryRow[];
	weeklyStatuses: WeeklyStatusRow[];
	attachments: AttachmentMetadataRow[];
	serverTimestamp: string;
}

export interface SyncMutation {
	operation: 'upsert' | 'delete';
	data: Record<string, unknown>;
	clientUpdatedAt?: string;
}

export interface SyncPushRequest {
	changes: {
		[tableName: string]: SyncMutation[];
	};
}

export interface SyncPushResponse {
	applied: number;
	conflicts: number;
	serverTimestamp: string;
}

// --- Client-side sync engine types ---

/** The set of table names included in sync operations. */
export const SYNC_TABLE_NAMES = [
	'clients',
	'contracts',
	'deliverables',
	'workTypes',
	'timeEntries',
	'notes',
	'noteLinks',
	'noteTimeEntries',
	'weeklyStatuses',
	'attachments'
] as const;

export type SyncTableName = (typeof SYNC_TABLE_NAMES)[number];

/** A mutation queued locally, waiting to be pushed to the server. */
export interface PendingMutation {
	id: string;
	table: string;
	entityId: string;
	operation: 'upsert' | 'delete';
	data: Record<string, unknown>;
	timestamp: string;
}

/** The current state of the sync engine. */
export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

/** Result of a full sync cycle (push + pull). */
export interface SyncResult {
	pulled: number;
	pushed: number;
	conflicts: number;
	errors: string[];
}

/** Result of a pull-only operation. */
export interface PullResult {
	pulled: number;
	errors: string[];
}

/** Result of a push-only operation. */
export interface PushResult {
	pushed: number;
	conflicts: number;
	errors: string[];
}
