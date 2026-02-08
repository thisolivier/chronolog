/**
 * SQLite Schema Definitions
 *
 * Contains table name mappings, boolean column registry, compound primary key
 * definitions, and CREATE TABLE statements for the local SQLite database.
 * These constants are consumed by SqliteAdapter and the helper modules.
 */

import type { TableName } from './types';

// ---------------------------------------------------------------------------
// Table name mapping: camelCase TypeScript names -> snake_case SQL names
// ---------------------------------------------------------------------------

export const TABLE_NAME_MAP: Record<TableName, string> = {
	clients: 'clients',
	contracts: 'contracts',
	deliverables: 'deliverables',
	workTypes: 'work_types',
	timeEntries: 'time_entries',
	notes: 'notes',
	noteLinks: 'note_links',
	noteTimeEntries: 'note_time_entries',
	weeklyStatuses: 'weekly_statuses',
	attachments: 'attachments'
};

// ---------------------------------------------------------------------------
// Boolean field registry — columns that need 0/1 <-> true/false conversion
// ---------------------------------------------------------------------------

export const BOOLEAN_COLUMNS: Set<string> = new Set([
	'is_active',
	'is_draft',
	'is_pinned'
]);

// ---------------------------------------------------------------------------
// Compound primary key definitions for junction tables
// ---------------------------------------------------------------------------

export const COMPOUND_PRIMARY_KEYS: Partial<Record<TableName, string[]>> = {
	noteLinks: ['source_note_id', 'target_note_id'],
	noteTimeEntries: ['note_id', 'time_entry_id']
};

// ---------------------------------------------------------------------------
// SQL schema definitions
// ---------------------------------------------------------------------------

export const CREATE_TABLE_STATEMENTS: string[] = [
	`CREATE TABLE IF NOT EXISTS clients (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		name TEXT NOT NULL,
		short_code TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS contracts (
		id TEXT PRIMARY KEY,
		client_id TEXT NOT NULL,
		name TEXT NOT NULL,
		description TEXT,
		is_active INTEGER NOT NULL DEFAULT 1,
		sort_order INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS deliverables (
		id TEXT PRIMARY KEY,
		contract_id TEXT NOT NULL,
		name TEXT NOT NULL,
		sort_order INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS work_types (
		id TEXT PRIMARY KEY,
		deliverable_id TEXT NOT NULL,
		name TEXT NOT NULL,
		sort_order INTEGER NOT NULL DEFAULT 0
	)`,
	`CREATE TABLE IF NOT EXISTS time_entries (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		contract_id TEXT NOT NULL,
		deliverable_id TEXT,
		work_type_id TEXT,
		date TEXT NOT NULL,
		start_time TEXT,
		end_time TEXT,
		duration_minutes INTEGER NOT NULL,
		description TEXT,
		is_draft INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS notes (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		contract_id TEXT NOT NULL,
		title TEXT,
		content TEXT,
		content_json TEXT,
		word_count INTEGER NOT NULL DEFAULT 0,
		is_pinned INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS note_links (
		source_note_id TEXT NOT NULL,
		target_note_id TEXT NOT NULL,
		heading_anchor TEXT,
		created_at TEXT NOT NULL,
		PRIMARY KEY (source_note_id, target_note_id)
	)`,
	`CREATE TABLE IF NOT EXISTS note_time_entries (
		note_id TEXT NOT NULL,
		time_entry_id TEXT NOT NULL,
		heading_anchor TEXT,
		PRIMARY KEY (note_id, time_entry_id)
	)`,
	`CREATE TABLE IF NOT EXISTS weekly_statuses (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		week_start TEXT NOT NULL,
		year INTEGER NOT NULL,
		week_number INTEGER NOT NULL,
		status TEXT NOT NULL DEFAULT 'Unsubmitted',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		note_id TEXT NOT NULL,
		filename TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size_bytes INTEGER NOT NULL,
		created_at TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS _blobs (
		attachment_id TEXT PRIMARY KEY,
		data BLOB NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS _sync_queue (
		id TEXT PRIMARY KEY,
		table_name TEXT NOT NULL,
		entity_id TEXT NOT NULL,
		operation TEXT NOT NULL,
		data TEXT NOT NULL,
		timestamp TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS _sync_meta (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`
];
