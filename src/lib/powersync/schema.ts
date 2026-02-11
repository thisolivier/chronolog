/**
 * PowerSync Client Schema
 *
 * Defines the local SQLite schema that PowerSync manages.
 * Mirrors the server-side Drizzle schema. PowerSync auto-creates
 * an `id` column (text) on every table — do not declare it.
 *
 * Column types: column.text, column.integer, column.real
 * Booleans are stored as integers (0/1) in SQLite.
 */

import { column, Schema, Table } from '@powersync/web';

const clientsTable = new Table(
	{
		user_id: column.text,
		name: column.text,
		short_code: column.text,
		created_at: column.text,
		updated_at: column.text
	},
	{ indexes: { by_user: ['user_id'] } }
);

const contractsTable = new Table(
	{
		user_id: column.text,
		client_id: column.text,
		name: column.text,
		description: column.text,
		is_active: column.integer, // boolean as 0/1
		sort_order: column.integer,
		created_at: column.text,
		updated_at: column.text
	},
	{ indexes: { by_client: ['client_id'] } }
);

const deliverablesTable = new Table(
	{
		user_id: column.text,
		contract_id: column.text,
		name: column.text,
		sort_order: column.integer,
		created_at: column.text,
		updated_at: column.text
	},
	{ indexes: { by_contract: ['contract_id'] } }
);

const workTypesTable = new Table(
	{
		user_id: column.text,
		deliverable_id: column.text,
		name: column.text,
		sort_order: column.integer
	},
	{ indexes: { by_deliverable: ['deliverable_id'] } }
);

const timeEntriesTable = new Table(
	{
		user_id: column.text,
		contract_id: column.text,
		deliverable_id: column.text,
		work_type_id: column.text,
		date: column.text,
		start_time: column.text,
		end_time: column.text,
		duration_minutes: column.integer,
		description: column.text,
		is_draft: column.integer, // boolean as 0/1
		created_at: column.text,
		updated_at: column.text
	},
	{ indexes: { by_user: ['user_id'], by_contract: ['contract_id'], by_date: ['date'] } }
);

const notesTable = new Table(
	{
		user_id: column.text,
		contract_id: column.text,
		title: column.text,
		content: column.text,
		content_json: column.text,
		word_count: column.integer,
		is_pinned: column.integer, // boolean as 0/1
		created_at: column.text,
		updated_at: column.text
	},
	{ indexes: { by_user: ['user_id'], by_contract: ['contract_id'] } }
);

const noteLinksTable = new Table(
	{
		user_id: column.text,
		source_note_id: column.text,
		target_note_id: column.text,
		heading_anchor: column.text,
		created_at: column.text
	},
	{ indexes: { by_source: ['source_note_id'], by_target: ['target_note_id'] } }
);

const noteTimeEntriesTable = new Table(
	{
		user_id: column.text,
		note_id: column.text,
		time_entry_id: column.text,
		heading_anchor: column.text
	},
	{ indexes: { by_note: ['note_id'], by_time_entry: ['time_entry_id'] } }
);

const weeklyStatusesTable = new Table(
	{
		user_id: column.text,
		week_start: column.text,
		year: column.integer,
		week_number: column.integer,
		status: column.text,
		created_at: column.text,
		updated_at: column.text
	},
	{ indexes: { by_user_week: ['user_id', 'year', 'week_number'] } }
);

const attachmentsTable = new Table(
	{
		user_id: column.text,
		note_id: column.text,
		filename: column.text,
		mime_type: column.text,
		size_bytes: column.integer,
		created_at: column.text
	},
	{ indexes: { by_note: ['note_id'] } }
);

export const AppSchema = new Schema({
	clients: clientsTable,
	contracts: contractsTable,
	deliverables: deliverablesTable,
	work_types: workTypesTable,
	time_entries: timeEntriesTable,
	notes: notesTable,
	note_links: noteLinksTable,
	note_time_entries: noteTimeEntriesTable,
	weekly_statuses: weeklyStatusesTable,
	attachments: attachmentsTable
});

export type Database = (typeof AppSchema)['types'];
export type ClientRecord = Database['clients'];
export type ContractRecord = Database['contracts'];
export type NoteRecord = Database['notes'];
export type TimeEntryRecord = Database['time_entries'];
