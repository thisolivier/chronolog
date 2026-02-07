/**
 * DexieAdapter — StorageAdapter implementation backed by IndexedDB via Dexie.js.
 *
 * Used in the PWA / browser environment. The Tauri desktop app uses
 * SqliteAdapter instead. Both implement the same StorageAdapter interface
 * defined in ./types.ts.
 */

import Dexie, { type Table } from 'dexie';
import type {
	StorageAdapter,
	TableName,
	TableRowMap,
	ClientRow,
	ContractRow,
	DeliverableRow,
	WorkTypeRow,
	TimeEntryRow,
	NoteRow,
	NoteLinkRow,
	NoteTimeEntryRow,
	WeeklyStatusRow,
	AttachmentRow
} from './types';

// ---------------------------------------------------------------------------
// Blob row type (not part of the public TableRowMap)
// ---------------------------------------------------------------------------

type BlobRow = {
	attachmentId: string;
	data: Blob;
};

// ---------------------------------------------------------------------------
// Tables with compound primary keys (no auto-generated `id` column)
// ---------------------------------------------------------------------------

const COMPOUND_KEY_TABLES: ReadonlySet<string> = new Set(['noteLinks', 'noteTimeEntries']);

// ---------------------------------------------------------------------------
// Dexie database definition
// ---------------------------------------------------------------------------

class ChronologDatabase extends Dexie {
	clients!: Table<ClientRow, string>;
	contracts!: Table<ContractRow, string>;
	deliverables!: Table<DeliverableRow, string>;
	workTypes!: Table<WorkTypeRow, string>;
	timeEntries!: Table<TimeEntryRow, string>;
	notes!: Table<NoteRow, string>;
	noteLinks!: Table<NoteLinkRow, [string, string]>;
	noteTimeEntries!: Table<NoteTimeEntryRow, [string, string]>;
	weeklyStatuses!: Table<WeeklyStatusRow, string>;
	attachments!: Table<AttachmentRow, string>;
	_blobs!: Table<BlobRow, string>;

	constructor(databaseName: string = 'chronolog') {
		super(databaseName);

		this.version(1).stores({
			clients: 'id, userId, shortCode',
			contracts: 'id, clientId, isActive',
			deliverables: 'id, contractId, sortOrder',
			workTypes: 'id, deliverableId, sortOrder',
			timeEntries: 'id, userId, contractId, deliverableId, workTypeId, date',
			notes: 'id, userId, contractId',
			noteLinks: '[sourceNoteId+targetNoteId], sourceNoteId, targetNoteId',
			noteTimeEntries: '[noteId+timeEntryId], noteId, timeEntryId',
			weeklyStatuses: 'id, userId, year, weekNumber',
			attachments: 'id, noteId',
			_blobs: 'attachmentId'
		});
	}
}

// ---------------------------------------------------------------------------
// DexieAdapter
// ---------------------------------------------------------------------------

export class DexieAdapter implements StorageAdapter {
	private database: ChronologDatabase;

	constructor(databaseName: string = 'chronolog') {
		this.database = new ChronologDatabase(databaseName);
	}

	async init(): Promise<void> {
		await this.database.open();
	}

	async close(): Promise<void> {
		this.database.close();
	}

	async getAll<T extends TableName>(table: T): Promise<TableRowMap[T][]> {
		const dexieTable = this.database.table(table);
		return dexieTable.toArray() as Promise<TableRowMap[T][]>;
	}

	async getById<T extends TableName>(
		table: T,
		id: string
	): Promise<TableRowMap[T] | null> {
		const dexieTable = this.database.table(table);

		if (COMPOUND_KEY_TABLES.has(table)) {
			// For compound-key tables the "id" is encoded as "part1|part2"
			const keyParts = id.split('|');
			const result = await dexieTable.get(keyParts);
			return (result ?? null) as TableRowMap[T] | null;
		}

		const result = await dexieTable.get(id);
		return (result ?? null) as TableRowMap[T] | null;
	}

	async query<T extends TableName>(
		table: T,
		filter: Partial<TableRowMap[T]>
	): Promise<TableRowMap[T][]> {
		const dexieTable = this.database.table(table);
		const filterEntries = Object.entries(filter);

		if (filterEntries.length === 0) {
			return dexieTable.toArray() as Promise<TableRowMap[T][]>;
		}

		// Use .filter() for arbitrary partial filters — simple and correct
		// at our expected data scale.
		const results = await dexieTable
			.filter((row: Record<string, unknown>) => {
				return filterEntries.every(
					([key, value]) => row[key] === value
				);
			})
			.toArray();

		return results as TableRowMap[T][];
	}

	async put<T extends TableName>(table: T, row: TableRowMap[T]): Promise<void> {
		const dexieTable = this.database.table(table);
		await dexieTable.put(row);
	}

	async bulkPut<T extends TableName>(
		table: T,
		rows: TableRowMap[T][]
	): Promise<void> {
		const dexieTable = this.database.table(table);
		await dexieTable.bulkPut(rows);
	}

	async delete(table: TableName, id: string): Promise<void> {
		const dexieTable = this.database.table(table);

		if (COMPOUND_KEY_TABLES.has(table)) {
			const keyParts = id.split('|');
			await dexieTable.delete(keyParts);
		} else {
			await dexieTable.delete(id);
		}
	}

	async clear(table: TableName): Promise<void> {
		const dexieTable = this.database.table(table);
		await dexieTable.clear();
	}

	// ---- Blob storage ----

	async putBlob(attachmentId: string, data: Blob): Promise<void> {
		await this.database._blobs.put({ attachmentId, data });
	}

	async getBlob(attachmentId: string): Promise<Blob | null> {
		const row = await this.database._blobs.get(attachmentId);
		return row?.data ?? null;
	}

	async deleteBlob(attachmentId: string): Promise<void> {
		await this.database._blobs.delete(attachmentId);
	}
}
