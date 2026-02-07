/**
 * SQLite Storage Adapter for Tauri Desktop
 *
 * Implements the StorageAdapter interface using @tauri-apps/plugin-sql to
 * provide client-side SQLite storage when running inside the Tauri shell.
 * This adapter is only loaded in the Tauri environment (see index.ts).
 *
 * Column names are stored in snake_case in SQLite and mapped to/from
 * camelCase TypeScript row types via helper functions.
 */

import Database from '@tauri-apps/plugin-sql';
import type { StorageAdapter, TableName, TableRowMap } from './types';
import {
	TABLE_NAME_MAP,
	COMPOUND_PRIMARY_KEYS,
	CREATE_TABLE_STATEMENTS
} from './sqlite-schema';
import {
	mapKeysToSnakeCase,
	prepareRowForWrite,
	transformRowFromRead
} from './sqlite-helpers';

// ---------------------------------------------------------------------------
// SqliteAdapter class
// ---------------------------------------------------------------------------

/**
 * StorageAdapter implementation backed by SQLite via @tauri-apps/plugin-sql.
 *
 * This adapter is designed to run exclusively inside a Tauri desktop shell.
 * It stores all data in a local `chronolog.db` SQLite file, using snake_case
 * column names internally while exposing camelCase TypeScript row types
 * through the StorageAdapter interface.
 */
export class SqliteAdapter implements StorageAdapter {
	private database: Database | null = null;

	/**
	 * Get the active database connection.
	 * Throws if init() has not been called.
	 */
	private getDatabase(): Database {
		if (!this.database) {
			throw new Error(
				'SqliteAdapter: Database not initialized. Call init() first.'
			);
		}
		return this.database;
	}

	/**
	 * Initialize the SQLite database connection and create all tables.
	 *
	 * Opens (or creates) the `chronolog.db` file and runs all
	 * CREATE TABLE IF NOT EXISTS statements to ensure the schema exists.
	 */
	async init(): Promise<void> {
		this.database = await Database.load('sqlite:chronolog.db');

		for (const createStatement of CREATE_TABLE_STATEMENTS) {
			await this.database.execute(createStatement);
		}
	}

	/**
	 * Close the database connection and release resources.
	 */
	async close(): Promise<void> {
		if (this.database) {
			await this.database.close();
			this.database = null;
		}
	}

	/**
	 * Retrieve all rows from a table.
	 *
	 * @param table - The table name (camelCase TypeScript name)
	 * @returns All rows in the table, mapped to camelCase
	 */
	async getAll<T extends TableName>(table: T): Promise<TableRowMap[T][]> {
		const database = this.getDatabase();
		const sqlTableName = TABLE_NAME_MAP[table];

		const rawRows = await database.select<Record<string, unknown>[]>(
			`SELECT * FROM ${sqlTableName}`
		);

		return rawRows.map(
			(row) => transformRowFromRead(row) as TableRowMap[T]
		);
	}

	/**
	 * Retrieve a single row by primary key. Returns null if not found.
	 *
	 * For tables with compound primary keys (noteLinks, noteTimeEntries),
	 * the id parameter is expected to be a JSON-encoded composite key
	 * (e.g. `JSON.stringify({ sourceNoteId, targetNoteId })`).
	 *
	 * @param table - The table name (camelCase TypeScript name)
	 * @param id - The primary key value, or JSON-encoded composite key
	 * @returns The matching row or null
	 */
	async getById<T extends TableName>(
		table: T,
		id: string
	): Promise<TableRowMap[T] | null> {
		const database = this.getDatabase();
		const sqlTableName = TABLE_NAME_MAP[table];
		const compoundKeys = COMPOUND_PRIMARY_KEYS[table];

		let rawRows: Record<string, unknown>[];

		if (compoundKeys) {
			// Parse the composite key from JSON
			const compositeKey = JSON.parse(id) as Record<string, unknown>;
			const snakeCaseKey = mapKeysToSnakeCase(compositeKey);

			const whereClauses: string[] = [];
			const whereValues: unknown[] = [];

			for (const keyColumn of compoundKeys) {
				whereClauses.push(`${keyColumn} = ?`);
				whereValues.push(snakeCaseKey[keyColumn]);
			}

			rawRows = await database.select<Record<string, unknown>[]>(
				`SELECT * FROM ${sqlTableName} WHERE ${whereClauses.join(' AND ')}`,
				whereValues
			);
		} else {
			rawRows = await database.select<Record<string, unknown>[]>(
				`SELECT * FROM ${sqlTableName} WHERE id = ?`,
				[id]
			);
		}

		if (rawRows.length === 0) {
			return null;
		}

		return transformRowFromRead(rawRows[0]) as TableRowMap[T];
	}

	/**
	 * Retrieve rows matching a partial filter.
	 *
	 * Each key in the filter is ANDed together. Uses parameterized queries
	 * to prevent SQL injection.
	 *
	 * @param table - The table name (camelCase TypeScript name)
	 * @param filter - Partial row object with fields to match
	 * @returns All matching rows
	 */
	async query<T extends TableName>(
		table: T,
		filter: Partial<TableRowMap[T]>
	): Promise<TableRowMap[T][]> {
		const database = this.getDatabase();
		const sqlTableName = TABLE_NAME_MAP[table];

		const snakeCaseFilter = prepareRowForWrite(
			filter as Record<string, unknown>
		);

		const filterEntries = Object.entries(snakeCaseFilter);

		if (filterEntries.length === 0) {
			return this.getAll(table);
		}

		const whereClauses: string[] = [];
		const whereValues: unknown[] = [];

		for (const [columnName, value] of filterEntries) {
			if (value === null) {
				whereClauses.push(`${columnName} IS NULL`);
			} else {
				whereClauses.push(`${columnName} = ?`);
				whereValues.push(value);
			}
		}

		const rawRows = await database.select<Record<string, unknown>[]>(
			`SELECT * FROM ${sqlTableName} WHERE ${whereClauses.join(' AND ')}`,
			whereValues
		);

		return rawRows.map(
			(row) => transformRowFromRead(row) as TableRowMap[T]
		);
	}

	/**
	 * Insert or replace a single row (upsert by primary key).
	 *
	 * Uses INSERT OR REPLACE to perform an upsert. Boolean values are
	 * automatically converted to 0/1 for SQLite storage.
	 *
	 * @param table - The table name (camelCase TypeScript name)
	 * @param row - The full row to insert or replace
	 */
	async put<T extends TableName>(
		table: T,
		row: TableRowMap[T]
	): Promise<void> {
		const database = this.getDatabase();
		const sqlTableName = TABLE_NAME_MAP[table];

		const snakeCaseRow = prepareRowForWrite(
			row as Record<string, unknown>
		);
		const columnNames = Object.keys(snakeCaseRow);
		const columnValues = Object.values(snakeCaseRow);
		const placeholders = columnNames.map(() => '?').join(', ');

		await database.execute(
			`INSERT OR REPLACE INTO ${sqlTableName} (${columnNames.join(', ')}) VALUES (${placeholders})`,
			columnValues
		);
	}

	/**
	 * Insert or replace multiple rows in a transaction (bulk upsert).
	 *
	 * Wraps all inserts in a BEGIN/COMMIT transaction for atomicity
	 * and performance. Rolls back on error.
	 *
	 * @param table - The table name (camelCase TypeScript name)
	 * @param rows - Array of full rows to insert or replace
	 */
	async bulkPut<T extends TableName>(
		table: T,
		rows: TableRowMap[T][]
	): Promise<void> {
		if (rows.length === 0) {
			return;
		}

		const database = this.getDatabase();

		await database.execute('BEGIN TRANSACTION');
		try {
			for (const row of rows) {
				await this.put(table, row);
			}
			await database.execute('COMMIT');
		} catch (error) {
			await database.execute('ROLLBACK');
			throw error;
		}
	}

	/**
	 * Delete a row by primary key.
	 *
	 * For tables with compound primary keys (noteLinks, noteTimeEntries),
	 * the id parameter is expected to be a JSON-encoded composite key.
	 *
	 * @param table - The table name (camelCase TypeScript name)
	 * @param id - The primary key value, or JSON-encoded composite key
	 */
	async delete(table: TableName, id: string): Promise<void> {
		const database = this.getDatabase();
		const sqlTableName = TABLE_NAME_MAP[table];
		const compoundKeys = COMPOUND_PRIMARY_KEYS[table];

		if (compoundKeys) {
			const compositeKey = JSON.parse(id) as Record<string, unknown>;
			const snakeCaseKey = mapKeysToSnakeCase(compositeKey);

			const whereClauses: string[] = [];
			const whereValues: unknown[] = [];

			for (const keyColumn of compoundKeys) {
				whereClauses.push(`${keyColumn} = ?`);
				whereValues.push(snakeCaseKey[keyColumn]);
			}

			await database.execute(
				`DELETE FROM ${sqlTableName} WHERE ${whereClauses.join(' AND ')}`,
				whereValues
			);
		} else {
			await database.execute(
				`DELETE FROM ${sqlTableName} WHERE id = ?`,
				[id]
			);
		}
	}

	/**
	 * Delete all rows from a table.
	 *
	 * @param table - The table name (camelCase TypeScript name)
	 */
	async clear(table: TableName): Promise<void> {
		const database = this.getDatabase();
		const sqlTableName = TABLE_NAME_MAP[table];

		await database.execute(`DELETE FROM ${sqlTableName}`);
	}

	/**
	 * Store binary attachment data in the _blobs table.
	 *
	 * Converts the Blob to an ArrayBuffer before storing as a SQLite BLOB.
	 *
	 * @param attachmentId - The attachment ID to associate the blob with
	 * @param data - The binary data as a Blob
	 */
	async putBlob(attachmentId: string, data: Blob): Promise<void> {
		const database = this.getDatabase();
		const arrayBuffer = await data.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);

		await database.execute(
			'INSERT OR REPLACE INTO _blobs (attachment_id, data) VALUES (?, ?)',
			[attachmentId, Array.from(uint8Array)]
		);
	}

	/**
	 * Retrieve binary attachment data from the _blobs table.
	 *
	 * @param attachmentId - The attachment ID to look up
	 * @returns The binary data as a Blob, or null if not found
	 */
	async getBlob(attachmentId: string): Promise<Blob | null> {
		const database = this.getDatabase();

		const rawRows = await database.select<
			{ data: number[] }[]
		>('SELECT data FROM _blobs WHERE attachment_id = ?', [attachmentId]);

		if (rawRows.length === 0) {
			return null;
		}

		const uint8Array = new Uint8Array(rawRows[0].data);
		return new Blob([uint8Array]);
	}

	/**
	 * Delete binary attachment data from the _blobs table.
	 *
	 * @param attachmentId - The attachment ID whose blob should be deleted
	 */
	async deleteBlob(attachmentId: string): Promise<void> {
		const database = this.getDatabase();

		await database.execute(
			'DELETE FROM _blobs WHERE attachment_id = ?',
			[attachmentId]
		);
	}
}
