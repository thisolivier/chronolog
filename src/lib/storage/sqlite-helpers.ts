/**
 * SQLite Helper Functions
 *
 * Provides case-conversion utilities (camelCase <-> snake_case) and boolean
 * conversion helpers (TypeScript booleans <-> SQLite 0/1 integers) used by
 * the SqliteAdapter when reading from and writing to the local SQLite database.
 */

import { BOOLEAN_COLUMNS } from './sqlite-schema';

// ---------------------------------------------------------------------------
// Case conversion helpers
// ---------------------------------------------------------------------------

/** Convert a camelCase string to snake_case. */
export function toSnakeCase(str: string): string {
	return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Convert a snake_case string to camelCase. */
export function toCamelCase(str: string): string {
	return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Map all keys of a row object from camelCase to snake_case. */
export function mapKeysToSnakeCase(
	row: Record<string, unknown>
): Record<string, unknown> {
	const mapped: Record<string, unknown> = {};
	for (const key of Object.keys(row)) {
		mapped[toSnakeCase(key)] = row[key];
	}
	return mapped;
}

/** Map all keys of a row object from snake_case to camelCase. */
export function mapKeysToCamelCase(
	row: Record<string, unknown>
): Record<string, unknown> {
	const mapped: Record<string, unknown> = {};
	for (const key of Object.keys(row)) {
		mapped[toCamelCase(key)] = row[key];
	}
	return mapped;
}

// ---------------------------------------------------------------------------
// Boolean conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert TypeScript boolean values to SQLite integers (0/1) for writing.
 * Only converts values whose snake_case column name is in BOOLEAN_COLUMNS.
 */
export function convertBooleansForWrite(
	snakeCaseRow: Record<string, unknown>
): Record<string, unknown> {
	const converted: Record<string, unknown> = {};
	for (const [columnName, value] of Object.entries(snakeCaseRow)) {
		if (BOOLEAN_COLUMNS.has(columnName) && typeof value === 'boolean') {
			converted[columnName] = value ? 1 : 0;
		} else {
			converted[columnName] = value;
		}
	}
	return converted;
}

/**
 * Convert SQLite integer values (0/1) back to TypeScript booleans for reading.
 * Only converts values whose snake_case column name is in BOOLEAN_COLUMNS.
 */
export function convertBooleansForRead(
	snakeCaseRow: Record<string, unknown>
): Record<string, unknown> {
	const converted: Record<string, unknown> = {};
	for (const [columnName, value] of Object.entries(snakeCaseRow)) {
		if (BOOLEAN_COLUMNS.has(columnName) && typeof value === 'number') {
			converted[columnName] = value !== 0;
		} else {
			converted[columnName] = value;
		}
	}
	return converted;
}

// ---------------------------------------------------------------------------
// Full row transformation pipelines
// ---------------------------------------------------------------------------

/**
 * Transform a TypeScript camelCase row into a snake_case SQLite row,
 * converting booleans to integers.
 */
export function prepareRowForWrite(
	row: Record<string, unknown>
): Record<string, unknown> {
	const snakeCaseRow = mapKeysToSnakeCase(row);
	return convertBooleansForWrite(snakeCaseRow);
}

/**
 * Transform a snake_case SQLite row into a TypeScript camelCase row,
 * converting integer booleans back to true/false.
 */
export function transformRowFromRead(
	row: Record<string, unknown>
): Record<string, unknown> {
	const withBooleans = convertBooleansForRead(row);
	return mapKeysToCamelCase(withBooleans);
}
