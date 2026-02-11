/**
 * PowerSync Local Mutation Functions
 *
 * Write operations against the local PowerSync SQLite database.
 * Each mutation inserts/updates/deletes rows locally; PowerSync's
 * CRUD queue automatically pushes changes to the server via the
 * BackendConnector.
 *
 * All functions take a PowerSyncDatabase instance as their first
 * argument and return results matching the DataService interface.
 */

import type { PowerSyncDatabase } from '@powersync/web';
import type {
	CreateContractInput,
	NoteSummary,
	NoteDetail,
	UpdateNoteInput,
	CreateTimeEntryInput,
	TimeEntryFields,
	TimerEntry,
	SaveTimerInput
} from '$lib/services/types';

// ============================================================
// Helpers
// ============================================================

/** Current ISO-8601 timestamp string. */
function nowISO(): string {
	return new Date().toISOString();
}

/** Format a Date as YYYYMMDD for note ID generation. */
function formatDateCompact(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}${month}${day}`;
}

/** Format a Date as YYYY-MM-DD for SQLite date columns. */
function formatDateISO(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Format a Date as HH:MM:SS for time-of-day columns. */
function formatTimeOfDay(date: Date): string {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	return `${hours}:${minutes}:${seconds}`;
}

/** Count words in a string (split on whitespace, filter empties). */
function countWords(text: string): number {
	return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Calculate the Monday of a given ISO week.
 * ISO weeks start on Monday; week 1 contains the year's first Thursday.
 */
function mondayOfISOWeek(year: number, weekNumber: number): string {
	// January 4th is always in ISO week 1
	const january4th = new Date(Date.UTC(year, 0, 4));
	const dayOfWeek = january4th.getUTCDay() || 7; // Convert Sunday=0 to 7
	const mondayOfWeek1 = new Date(january4th);
	mondayOfWeek1.setUTCDate(january4th.getUTCDate() - (dayOfWeek - 1));

	// Add (weekNumber - 1) * 7 days to get the target Monday
	const targetMonday = new Date(mondayOfWeek1);
	targetMonday.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNumber - 1) * 7);

	const yearPart = targetMonday.getUTCFullYear();
	const monthPart = String(targetMonday.getUTCMonth() + 1).padStart(2, '0');
	const dayPart = String(targetMonday.getUTCDate()).padStart(2, '0');
	return `${yearPart}-${monthPart}-${dayPart}`;
}

// ============================================================
// 1. createContract
// ============================================================

export async function createContract(
	database: PowerSyncDatabase,
	data: CreateContractInput
): Promise<{ id: string }> {
	const contractId = crypto.randomUUID();
	const timestamp = nowISO();

	await database.execute(
		`INSERT INTO contracts (id, client_id, name, description, is_active, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			contractId,
			data.clientId,
			data.name,
			data.description ?? null,
			data.isActive === false ? 0 : 1,
			0,
			timestamp,
			timestamp
		]
	);

	return { id: contractId };
}

// ============================================================
// 2. createNote
// ============================================================

export async function createNote(
	database: PowerSyncDatabase,
	contractId: string
): Promise<NoteSummary> {
	// Look up the client short_code via contracts -> clients join
	const contractRow = await database.get<{ client_id: string }>(
		`SELECT client_id FROM contracts WHERE id = ?`,
		[contractId]
	);

	const clientRow = await database.get<{ short_code: string }>(
		`SELECT short_code FROM clients WHERE id = ?`,
		[contractRow.client_id]
	);

	const shortCode = clientRow.short_code;
	const today = new Date();
	const dateCompact = formatDateCompact(today);
	const noteIdPrefix = `${shortCode}.${dateCompact}`;

	// Find existing notes for today with the same prefix to determine sequence
	const existingNotes = await database.getAll<{ id: string }>(
		`SELECT id FROM notes WHERE id LIKE ?`,
		[`${noteIdPrefix}.%`]
	);

	const sequenceNumber = existingNotes.length + 1;
	const paddedSequence = String(sequenceNumber).padStart(3, '0');
	const noteId = `${noteIdPrefix}.${paddedSequence}`;

	const timestamp = nowISO();

	await database.execute(
		`INSERT INTO notes (id, user_id, contract_id, is_pinned, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[noteId, '', contractId, 0, timestamp, timestamp]
	);

	return {
		id: noteId,
		contractId,
		isPinned: false,
		createdAt: timestamp,
		updatedAt: timestamp,
		firstLine: '',
		secondLine: ''
	};
}

// ============================================================
// 3. updateNote
// ============================================================

export async function updateNote(
	database: PowerSyncDatabase,
	noteId: string,
	data: UpdateNoteInput
): Promise<NoteDetail> {
	const setClauses: string[] = [];
	const parameterValues: unknown[] = [];

	if (data.title !== undefined) {
		setClauses.push('title = ?');
		parameterValues.push(data.title);
	}

	if (data.content !== undefined) {
		setClauses.push('content = ?');
		parameterValues.push(data.content);

		const wordCount = countWords(data.content);
		setClauses.push('word_count = ?');
		parameterValues.push(wordCount);
	}

	if (data.contentJson !== undefined) {
		setClauses.push('content_json = ?');
		parameterValues.push(data.contentJson);
	}

	if (data.isPinned !== undefined) {
		setClauses.push('is_pinned = ?');
		parameterValues.push(data.isPinned ? 1 : 0);
	}

	const timestamp = nowISO();
	setClauses.push('updated_at = ?');
	parameterValues.push(timestamp);

	parameterValues.push(noteId);

	await database.execute(
		`UPDATE notes SET ${setClauses.join(', ')} WHERE id = ?`,
		parameterValues
	);

	const updatedRow = await database.get<{
		id: string;
		title: string | null;
		content: string | null;
		content_json: string | null;
		contract_id: string;
		word_count: number | null;
		is_pinned: number;
		created_at: string;
		updated_at: string;
	}>(`SELECT * FROM notes WHERE id = ?`, [noteId]);

	return {
		id: updatedRow.id,
		title: updatedRow.title,
		content: updatedRow.content,
		contentJson: updatedRow.content_json,
		contractId: updatedRow.contract_id,
		wordCount: updatedRow.word_count ?? 0,
		isPinned: updatedRow.is_pinned === 1,
		createdAt: updatedRow.created_at,
		updatedAt: updatedRow.updated_at
	};
}

// ============================================================
// 4. deleteNote
// ============================================================

export async function deleteNote(
	database: PowerSyncDatabase,
	noteId: string
): Promise<void> {
	await database.execute(
		`DELETE FROM note_time_entries WHERE note_id = ?`,
		[noteId]
	);
	await database.execute(
		`DELETE FROM note_links WHERE source_note_id = ? OR target_note_id = ?`,
		[noteId, noteId]
	);
	await database.execute(
		`DELETE FROM attachments WHERE note_id = ?`,
		[noteId]
	);
	await database.execute(
		`DELETE FROM notes WHERE id = ?`,
		[noteId]
	);
}

// ============================================================
// 5. deleteAttachment
// ============================================================

export async function deleteAttachment(
	database: PowerSyncDatabase,
	attachmentId: string
): Promise<void> {
	await database.execute(
		`DELETE FROM attachments WHERE id = ?`,
		[attachmentId]
	);
}

// ============================================================
// 6. unlinkNoteTimeEntry
// ============================================================

export async function unlinkNoteTimeEntry(
	database: PowerSyncDatabase,
	noteId: string,
	timeEntryId: string
): Promise<void> {
	await database.execute(
		`DELETE FROM note_time_entries WHERE note_id = ? AND time_entry_id = ?`,
		[noteId, timeEntryId]
	);
}

// ============================================================
// 7. createTimeEntry
// ============================================================

export async function createTimeEntry(
	database: PowerSyncDatabase,
	data: CreateTimeEntryInput
): Promise<{ id: string }> {
	const entryId = crypto.randomUUID();
	const timestamp = nowISO();

	await database.execute(
		`INSERT INTO time_entries
		 (id, user_id, contract_id, date, start_time, end_time, duration_minutes, description, is_draft, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			entryId,
			'',
			data.contractId,
			data.date,
			data.startTime ?? null,
			data.endTime ?? null,
			data.durationMinutes,
			data.description ?? null,
			0,
			timestamp,
			timestamp
		]
	);

	return { id: entryId };
}

// ============================================================
// 8. updateTimeEntry
// ============================================================

/** Map camelCase TimeEntryFields keys to snake_case column names. */
const TIME_ENTRY_COLUMN_MAP: Record<string, string> = {
	contractId: 'contract_id',
	deliverableId: 'deliverable_id',
	workTypeId: 'work_type_id',
	date: 'date',
	startTime: 'start_time',
	endTime: 'end_time',
	durationMinutes: 'duration_minutes',
	description: 'description'
};

export async function updateTimeEntry(
	database: PowerSyncDatabase,
	entryId: string,
	data: Partial<TimeEntryFields>
): Promise<void> {
	const setClauses: string[] = [];
	const parameterValues: unknown[] = [];

	for (const [camelKey, value] of Object.entries(data)) {
		const columnName = TIME_ENTRY_COLUMN_MAP[camelKey];
		if (columnName && value !== undefined) {
			setClauses.push(`${columnName} = ?`);
			parameterValues.push(value);
		}
	}

	if (setClauses.length === 0) {
		return;
	}

	const timestamp = nowISO();
	setClauses.push('updated_at = ?');
	parameterValues.push(timestamp);

	parameterValues.push(entryId);

	await database.execute(
		`UPDATE time_entries SET ${setClauses.join(', ')} WHERE id = ?`,
		parameterValues
	);
}

// ============================================================
// 9. deleteTimeEntry
// ============================================================

export async function deleteTimeEntry(
	database: PowerSyncDatabase,
	entryId: string
): Promise<void> {
	await database.execute(
		`DELETE FROM note_time_entries WHERE time_entry_id = ?`,
		[entryId]
	);
	await database.execute(
		`DELETE FROM time_entries WHERE id = ?`,
		[entryId]
	);
}

// ============================================================
// 10. updateWeeklyStatus
// ============================================================

export async function updateWeeklyStatus(
	database: PowerSyncDatabase,
	year: number,
	weekNumber: number,
	status: string
): Promise<void> {
	const weekStart = mondayOfISOWeek(year, weekNumber);
	const timestamp = nowISO();

	const existingRows = await database.getAll<{ id: string }>(
		`SELECT id FROM weekly_statuses WHERE year = ? AND week_number = ?`,
		[year, weekNumber]
	);

	if (existingRows.length > 0) {
		await database.execute(
			`UPDATE weekly_statuses SET status = ?, updated_at = ? WHERE id = ?`,
			[status, timestamp, existingRows[0].id]
		);
	} else {
		const statusId = crypto.randomUUID();
		await database.execute(
			`INSERT INTO weekly_statuses
			 (id, user_id, week_start, year, week_number, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[statusId, '', weekStart, year, weekNumber, status, timestamp, timestamp]
		);
	}
}

// ============================================================
// 11. startTimer
// ============================================================

export async function startTimer(
	database: PowerSyncDatabase,
	contractId?: string
): Promise<TimerEntry> {
	// If no contractId provided, use the first active contract
	let resolvedContractId = contractId;
	if (!resolvedContractId) {
		const firstActiveContract = await database.get<{ id: string }>(
			`SELECT id FROM contracts WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1`
		);
		resolvedContractId = firstActiveContract.id;
	}

	// Check no existing draft timer
	const existingDrafts = await database.getAll<{ id: string }>(
		`SELECT id FROM time_entries WHERE is_draft = 1`
	);
	if (existingDrafts.length > 0) {
		throw new Error('A draft timer already exists. Stop or discard it before starting a new one.');
	}

	const entryId = crypto.randomUUID();
	const now = new Date();
	const timestamp = nowISO();
	const startTime = formatTimeOfDay(now);
	const todayDate = formatDateISO(now);

	await database.execute(
		`INSERT INTO time_entries
		 (id, user_id, contract_id, date, start_time, duration_minutes, is_draft, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[entryId, '', resolvedContractId, todayDate, startTime, 0, 1, timestamp, timestamp]
	);

	return {
		id: entryId,
		startTime,
		endTime: null,
		durationMinutes: 0
	};
}

// ============================================================
// 12. stopTimer
// ============================================================

export async function stopTimer(
	database: PowerSyncDatabase
): Promise<TimerEntry> {
	const draftTimer = await database.get<{
		id: string;
		start_time: string | null;
		date: string;
	}>(`SELECT id, start_time, date FROM time_entries WHERE is_draft = 1 LIMIT 1`);

	const now = new Date();
	const endTime = formatTimeOfDay(now);
	const timestamp = nowISO();

	// Calculate duration in minutes from start_time to now
	let durationMinutes = 0;
	if (draftTimer.start_time) {
		const [startHours, startMinutes, startSeconds] = draftTimer.start_time.split(':').map(Number);
		const startTotalSeconds = startHours * 3600 + startMinutes * 60 + (startSeconds || 0);
		const endTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
		durationMinutes = Math.max(0, Math.round((endTotalSeconds - startTotalSeconds) / 60));
	}

	await database.execute(
		`UPDATE time_entries SET end_time = ?, duration_minutes = ?, updated_at = ? WHERE id = ?`,
		[endTime, durationMinutes, timestamp, draftTimer.id]
	);

	return {
		id: draftTimer.id,
		startTime: draftTimer.start_time,
		endTime,
		durationMinutes
	};
}

// ============================================================
// 13. saveTimer
// ============================================================

export async function saveTimer(
	database: PowerSyncDatabase,
	data: SaveTimerInput
): Promise<void> {
	const timestamp = nowISO();

	await database.execute(
		`UPDATE time_entries
		 SET is_draft = 0,
		     contract_id = ?,
		     deliverable_id = ?,
		     work_type_id = ?,
		     description = ?,
		     updated_at = ?
		 WHERE id = ? AND is_draft = 1`,
		[
			data.contractId,
			data.deliverableId,
			data.workTypeId,
			data.description,
			timestamp,
			data.entryId
		]
	);
}

// ============================================================
// 14. discardTimer
// ============================================================

export async function discardTimer(
	database: PowerSyncDatabase,
	entryId: string
): Promise<void> {
	await database.execute(
		`DELETE FROM time_entries WHERE id = ? AND is_draft = 1`,
		[entryId]
	);
}
