/**
 * Mock Storage Adapter for Sync Tests
 *
 * In-memory implementation of the StorageAdapter interface, including
 * the sync queue and sync metadata methods. Used by unit tests so
 * they don't need IndexedDB or SQLite.
 */

import type {
	StorageAdapter,
	TableName,
	TableRowMap,
	SyncQueueItem
} from '../../storage/types';

export class MockStorageAdapter implements StorageAdapter {
	private tables: Map<string, Map<string, Record<string, unknown>>> = new Map();
	private blobs: Map<string, Blob> = new Map();
	private syncQueueItems: Map<string, SyncQueueItem> = new Map();
	private syncMetaEntries: Map<string, string> = new Map();

	async init(): Promise<void> {
		// No-op for in-memory adapter
	}

	async close(): Promise<void> {
		this.tables.clear();
		this.blobs.clear();
		this.syncQueueItems.clear();
		this.syncMetaEntries.clear();
	}

	private getTable(table: string): Map<string, Record<string, unknown>> {
		if (!this.tables.has(table)) {
			this.tables.set(table, new Map());
		}
		return this.tables.get(table)!;
	}

	private getRowId(table: string, row: Record<string, unknown>): string {
		if (table === 'noteLinks') {
			return `${row.sourceNoteId}|${row.targetNoteId}`;
		}
		if (table === 'noteTimeEntries') {
			return `${row.noteId}|${row.timeEntryId}`;
		}
		return row.id as string;
	}

	async getAll<T extends TableName>(table: T): Promise<TableRowMap[T][]> {
		const tableData = this.getTable(table);
		return Array.from(tableData.values()) as TableRowMap[T][];
	}

	async getById<T extends TableName>(
		table: T,
		id: string
	): Promise<TableRowMap[T] | null> {
		const tableData = this.getTable(table);
		const row = tableData.get(id);
		return (row ?? null) as TableRowMap[T] | null;
	}

	async query<T extends TableName>(
		table: T,
		filter: Partial<TableRowMap[T]>
	): Promise<TableRowMap[T][]> {
		const allRows = await this.getAll(table);
		const filterEntries = Object.entries(filter);
		return allRows.filter((row) =>
			filterEntries.every(
				([key, value]) =>
					(row as Record<string, unknown>)[key] === value
			)
		);
	}

	async put<T extends TableName>(
		table: T,
		row: TableRowMap[T]
	): Promise<void> {
		const tableData = this.getTable(table);
		const rowId = this.getRowId(table, row as Record<string, unknown>);
		tableData.set(rowId, row as Record<string, unknown>);
	}

	async bulkPut<T extends TableName>(
		table: T,
		rows: TableRowMap[T][]
	): Promise<void> {
		for (const row of rows) {
			await this.put(table, row);
		}
	}

	async delete(table: TableName, id: string): Promise<void> {
		const tableData = this.getTable(table);
		tableData.delete(id);
	}

	async clear(table: TableName): Promise<void> {
		this.tables.set(table, new Map());
	}

	async putBlob(attachmentId: string, data: Blob): Promise<void> {
		this.blobs.set(attachmentId, data);
	}

	async getBlob(attachmentId: string): Promise<Blob | null> {
		return this.blobs.get(attachmentId) ?? null;
	}

	async deleteBlob(attachmentId: string): Promise<void> {
		this.blobs.delete(attachmentId);
	}

	// ---- Sync queue ----

	async putSyncQueueItem(item: SyncQueueItem): Promise<void> {
		this.syncQueueItems.set(item.id, item);
	}

	async getAllSyncQueueItems(): Promise<SyncQueueItem[]> {
		const items = Array.from(this.syncQueueItems.values());
		return items.sort((itemA, itemB) =>
			itemA.timestamp.localeCompare(itemB.timestamp)
		);
	}

	async deleteSyncQueueItem(id: string): Promise<void> {
		this.syncQueueItems.delete(id);
	}

	async clearSyncQueue(): Promise<void> {
		this.syncQueueItems.clear();
	}

	// ---- Sync metadata ----

	async getSyncMeta(key: string): Promise<string | null> {
		return this.syncMetaEntries.get(key) ?? null;
	}

	async setSyncMeta(key: string, value: string): Promise<void> {
		this.syncMetaEntries.set(key, value);
	}
}
