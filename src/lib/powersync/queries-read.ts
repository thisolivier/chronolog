/**
 * PowerSync Read Queries — Contracts, Clients, Notes
 *
 * Reads data from the local PowerSync SQLite database.
 * Returns properly typed results with camelCase field names.
 *
 * PowerSync sync rules handle user scoping — no user_id filters needed.
 * Booleans are stored as 0/1 integers in SQLite.
 * Timestamps are stored as ISO strings.
 */

import type { PowerSyncDatabase } from '@powersync/web';
import type {
	ContractsByClientResult,
	ContractOption,
	ClientSummary,
	NoteSummary,
	NoteDetail,
	Backlink,
	AttachmentSummary,
	NoteTimeEntryLink
} from '$lib/services/types';
import { extractPreviewLines } from '$lib/utils/extract-preview-lines';

/** Convert SQLite 0/1 integer to boolean. */
export function toBoolean(value: number | null): boolean {
	return value === 1;
}

// ── Contracts ───────────────────────────────────────────────

export async function queryContractsByClient(
	database: PowerSyncDatabase
): Promise<ContractsByClientResult[]> {
	const rows = await database.getAll<{
		id: string;
		name: string;
		is_active: number;
		client_id: string;
		client_name: string;
		client_short_code: string;
		note_count: number;
	}>(`
		SELECT
			contracts.id,
			contracts.name,
			contracts.is_active,
			contracts.client_id,
			clients.name AS client_name,
			clients.short_code AS client_short_code,
			COUNT(notes.id) AS note_count
		FROM contracts
		JOIN clients ON clients.id = contracts.client_id
		LEFT JOIN notes ON notes.contract_id = contracts.id
		GROUP BY contracts.id
		ORDER BY contracts.sort_order
	`);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		isActive: toBoolean(row.is_active),
		clientId: row.client_id,
		clientName: row.client_name,
		clientShortCode: row.client_short_code,
		clientEmoji: null,
		noteCount: row.note_count
	}));
}

export async function queryContracts(
	database: PowerSyncDatabase
): Promise<ContractOption[]> {
	const rows = await database.getAll<{
		id: string;
		name: string;
		is_active: number;
		client_id: string;
		client_name: string;
		client_short_code: string;
	}>(`
		SELECT
			contracts.id,
			contracts.name,
			contracts.is_active,
			contracts.client_id,
			clients.name AS client_name,
			clients.short_code AS client_short_code
		FROM contracts
		JOIN clients ON clients.id = contracts.client_id
		ORDER BY contracts.sort_order
	`);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		isActive: toBoolean(row.is_active),
		clientId: row.client_id,
		clientName: row.client_name,
		clientShortCode: row.client_short_code
	}));
}

// ── Clients ─────────────────────────────────────────────────

export async function queryClients(
	database: PowerSyncDatabase
): Promise<ClientSummary[]> {
	const rows = await database.getAll<{
		id: string;
		name: string;
		short_code: string;
	}>(`SELECT id, name, short_code FROM clients ORDER BY name`);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		shortCode: row.short_code
	}));
}

// ── Notes ───────────────────────────────────────────────────

export async function queryNotesForContract(
	database: PowerSyncDatabase,
	contractId: string
): Promise<NoteSummary[]> {
	const rows = await database.getAll<{
		id: string;
		contract_id: string;
		is_pinned: number;
		content_json: string | null;
		created_at: string;
		updated_at: string;
	}>(
		`
		SELECT id, contract_id, is_pinned, content_json, created_at, updated_at
		FROM notes
		WHERE contract_id = ?
		ORDER BY is_pinned DESC, updated_at DESC
		`,
		[contractId]
	);

	return rows.map((row) => {
		const preview = extractPreviewLines(row.content_json);
		return {
			id: row.id,
			contractId: row.contract_id,
			isPinned: toBoolean(row.is_pinned),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			firstLine: preview.firstLine,
			secondLine: preview.secondLine
		};
	});
}

export async function queryNoteById(
	database: PowerSyncDatabase,
	noteId: string
): Promise<NoteDetail> {
	const row = await database.get<{
		id: string;
		title: string | null;
		content: string | null;
		content_json: string | null;
		contract_id: string;
		word_count: number;
		is_pinned: number;
		created_at: string;
		updated_at: string;
	}>(`SELECT * FROM notes WHERE id = ?`, [noteId]);

	return {
		id: row.id,
		title: row.title,
		content: row.content,
		contentJson: row.content_json,
		contractId: row.contract_id,
		wordCount: row.word_count ?? 0,
		isPinned: toBoolean(row.is_pinned),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export async function queryNoteBacklinks(
	database: PowerSyncDatabase,
	noteId: string
): Promise<Backlink[]> {
	const rows = await database.getAll<{
		source_note_id: string;
		note_title: string | null;
		heading_anchor: string | null;
	}>(
		`
		SELECT
			note_links.source_note_id,
			notes.title AS note_title,
			note_links.heading_anchor
		FROM note_links
		JOIN notes ON notes.id = note_links.source_note_id
		WHERE note_links.target_note_id = ?
		`,
		[noteId]
	);

	return rows.map((row) => ({
		sourceNoteId: row.source_note_id,
		noteTitle: row.note_title,
		headingAnchor: row.heading_anchor
	}));
}

export async function queryNoteAttachments(
	database: PowerSyncDatabase,
	noteId: string
): Promise<AttachmentSummary[]> {
	const rows = await database.getAll<{
		id: string;
		filename: string;
		mime_type: string;
		size_bytes: number;
		created_at: string;
	}>(
		`
		SELECT id, filename, mime_type, size_bytes, created_at
		FROM attachments
		WHERE note_id = ?
		ORDER BY created_at DESC
		`,
		[noteId]
	);

	return rows.map((row) => ({
		id: row.id,
		filename: row.filename,
		mimeType: row.mime_type,
		sizeBytes: row.size_bytes,
		createdAt: row.created_at
	}));
}

export async function queryNoteTimeEntries(
	database: PowerSyncDatabase,
	noteId: string
): Promise<NoteTimeEntryLink[]> {
	const rows = await database.getAll<{
		note_id: string;
		time_entry_id: string;
		heading_anchor: string | null;
	}>(
		`SELECT note_id, time_entry_id, heading_anchor FROM note_time_entries WHERE note_id = ?`,
		[noteId]
	);

	return rows.map((row) => ({
		noteId: row.note_id,
		timeEntryId: row.time_entry_id,
		headingAnchor: row.heading_anchor
	}));
}
