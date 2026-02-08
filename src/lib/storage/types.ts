/**
 * Storage Abstraction Layer - Type Definitions
 *
 * Defines the StorageAdapter interface and row types for client-side storage.
 * The adapter is implemented by DexieAdapter (PWA/IndexedDB) and
 * SqliteAdapter (Tauri/SQLite). UI code uses the adapter via the factory
 * in index.ts and never references Dexie or SQLite directly.
 */

// ---------------------------------------------------------------------------
// Row types — mirror the server-side Drizzle schema
// ---------------------------------------------------------------------------

export type ClientRow = {
	id: string;
	userId: string;
	name: string;
	shortCode: string;
	createdAt: string;
	updatedAt: string;
};

export type ContractRow = {
	id: string;
	clientId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
};

export type DeliverableRow = {
	id: string;
	contractId: string;
	name: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
};

export type WorkTypeRow = {
	id: string;
	deliverableId: string;
	name: string;
	sortOrder: number;
};

export type TimeEntryRow = {
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
};

export type NoteRow = {
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
};

export type NoteLinkRow = {
	sourceNoteId: string;
	targetNoteId: string;
	headingAnchor: string | null;
	createdAt: string;
};

export type NoteTimeEntryRow = {
	noteId: string;
	timeEntryId: string;
	headingAnchor: string | null;
};

export type WeeklyStatusRow = {
	id: string;
	userId: string;
	weekStart: string;
	year: number;
	weekNumber: number;
	status: string;
	createdAt: string;
	updatedAt: string;
};

export type AttachmentRow = {
	id: string;
	noteId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
};

// ---------------------------------------------------------------------------
// Table name → row type mapping
// ---------------------------------------------------------------------------

export type TableRowMap = {
	clients: ClientRow;
	contracts: ContractRow;
	deliverables: DeliverableRow;
	workTypes: WorkTypeRow;
	timeEntries: TimeEntryRow;
	notes: NoteRow;
	noteLinks: NoteLinkRow;
	noteTimeEntries: NoteTimeEntryRow;
	weeklyStatuses: WeeklyStatusRow;
	attachments: AttachmentRow;
};

export type TableName = keyof TableRowMap;

// ---------------------------------------------------------------------------
// StorageAdapter interface
// ---------------------------------------------------------------------------

/**
 * Unified interface for client-side data storage.
 *
 * Implementations:
 *   - DexieAdapter  (PWA / mobile)  — IndexedDB via Dexie.js
 *   - SqliteAdapter (Tauri desktop) — SQLite via tauri-plugin-sql
 */
export interface StorageAdapter {
	/** Initialize the storage backend (create tables / open database). */
	init(): Promise<void>;

	/** Close the storage connection and release resources. */
	close(): Promise<void>;

	/** Retrieve all rows from a table. */
	getAll<T extends TableName>(table: T): Promise<TableRowMap[T][]>;

	/** Retrieve a single row by primary key. Returns null if not found. */
	getById<T extends TableName>(table: T, id: string): Promise<TableRowMap[T] | null>;

	/**
	 * Retrieve rows matching a partial filter.
	 * Each key in the filter is ANDed (all must match).
	 */
	query<T extends TableName>(
		table: T,
		filter: Partial<TableRowMap[T]>
	): Promise<TableRowMap[T][]>;

	/** Insert or replace a single row (upsert by primary key). */
	put<T extends TableName>(table: T, row: TableRowMap[T]): Promise<void>;

	/** Insert or replace multiple rows (bulk upsert). */
	bulkPut<T extends TableName>(table: T, rows: TableRowMap[T][]): Promise<void>;

	/** Delete a row by primary key. */
	delete(table: TableName, id: string): Promise<void>;

	/** Delete all rows from a table. */
	clear(table: TableName): Promise<void>;

	// ---- Blob storage (for attachment binary data) ----

	/** Store binary attachment data. */
	putBlob(attachmentId: string, data: Blob): Promise<void>;

	/** Retrieve binary attachment data. Returns null if not found. */
	getBlob(attachmentId: string): Promise<Blob | null>;

	/** Delete binary attachment data. */
	deleteBlob(attachmentId: string): Promise<void>;

	// ---- Sync queue storage (used by SyncQueue) ----

	/** Store a pending mutation in the sync queue. */
	putSyncQueueItem(item: SyncQueueItem): Promise<void>;

	/** Retrieve all pending mutations, ordered by timestamp. */
	getAllSyncQueueItems(): Promise<SyncQueueItem[]>;

	/** Delete a single mutation from the sync queue by ID. */
	deleteSyncQueueItem(id: string): Promise<void>;

	/** Remove all mutations from the sync queue. */
	clearSyncQueue(): Promise<void>;

	// ---- Sync metadata storage (used by SyncMetadata) ----

	/** Read a sync metadata value by key. Returns null if not set. */
	getSyncMeta(key: string): Promise<string | null>;

	/** Write a sync metadata key-value pair. */
	setSyncMeta(key: string, value: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Sync queue item type (stored in internal _sync_queue table)
// ---------------------------------------------------------------------------

export type SyncQueueItem = {
	id: string;
	table: string;
	entityId: string;
	operation: 'upsert' | 'delete';
	data: Record<string, unknown>;
	timestamp: string;
};
