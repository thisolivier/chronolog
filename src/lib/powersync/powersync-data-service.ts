/**
 * PowerSync-backed implementation of the DataService interface.
 *
 * Delegates read queries to queries-read.ts and queries-time.ts,
 * write mutations to mutations.ts, and falls back to a direct
 * fetch for binary uploads (attachments).
 *
 * Weekly time-entry queries (getWeeklyTimeEntries, getWeekSummaries)
 * are implemented inline since they require multi-table joins and
 * grouping not covered by the simpler query modules.
 */

import type { PowerSyncDatabase } from '@powersync/web';
import type { DataService } from '$lib/services/data-service';
import type {
	ContractsByClientResult,
	ContractOption,
	CreateContractInput,
	ClientSummary,
	NoteSummary,
	NoteDetail,
	UpdateNoteInput,
	Backlink,
	AttachmentSummary,
	NoteTimeEntryLink,
	TimeEntryFields,
	CreateTimeEntryInput,
	WeekData,
	WeekSummary,
	DayData,
	TimeEntryDisplay,
	TimerStatus,
	TimerEntry,
	SaveTimerInput,
	DeliverableOption,
	WorkTypeOption
} from '$lib/services/types';

// Read queries
import {
	queryContractsByClient,
	queryContracts,
	queryClients,
	queryNotesForContract,
	queryNoteById,
	queryNoteBacklinks,
	queryNoteAttachments,
	queryNoteTimeEntries
} from './queries-read';

import { queryTimerStatus, queryDeliverables, queryWorkTypes } from './queries-time';

// Mutations
import {
	createContract as mutateCreateContract,
	createNote as mutateCreateNote,
	updateNote as mutateUpdateNote,
	deleteNote as mutateDeleteNote,
	deleteAttachment as mutateDeleteAttachment,
	unlinkNoteTimeEntry as mutateUnlinkNoteTimeEntry,
	createTimeEntry as mutateCreateTimeEntry,
	updateTimeEntry as mutateUpdateTimeEntry,
	deleteTimeEntry as mutateDeleteTimeEntry,
	updateWeeklyStatus as mutateUpdateWeeklyStatus,
	startTimer as mutateStartTimer,
	stopTimer as mutateStopTimer,
	saveTimer as mutateSaveTimer,
	discardTimer as mutateDiscardTimer
} from './mutations';

// Utilities
import {
	getWeekDates,
	getSundayOfWeek,
	getIsoWeekNumber,
	getIsoYear,
	getMondayOfWeek
} from '$lib/utils/iso-week';

export class PowerSyncDataService implements DataService {
	private database: PowerSyncDatabase;

	constructor(database: PowerSyncDatabase) {
		this.database = database;
	}

	// ── Contracts ─────────────────────────────────────────────

	async getContractsByClient(): Promise<ContractsByClientResult[]> {
		return queryContractsByClient(this.database);
	}

	async getContracts(): Promise<ContractOption[]> {
		return queryContracts(this.database);
	}

	async createContract(data: CreateContractInput): Promise<{ id: string }> {
		return mutateCreateContract(this.database, data);
	}

	// ── Clients ───────────────────────────────────────────────

	async getClients(): Promise<ClientSummary[]> {
		return queryClients(this.database);
	}

	// ── Notes ─────────────────────────────────────────────────

	async getNotesForContract(contractId: string): Promise<NoteSummary[]> {
		return queryNotesForContract(this.database, contractId);
	}

	async getNoteById(noteId: string): Promise<NoteDetail> {
		return queryNoteById(this.database, noteId);
	}

	async createNote(contractId: string): Promise<NoteSummary> {
		return mutateCreateNote(this.database, contractId);
	}

	async updateNote(noteId: string, data: UpdateNoteInput): Promise<NoteDetail> {
		return mutateUpdateNote(this.database, noteId, data);
	}

	async deleteNote(noteId: string): Promise<void> {
		return mutateDeleteNote(this.database, noteId);
	}

	async getNoteBacklinks(noteId: string): Promise<Backlink[]> {
		return queryNoteBacklinks(this.database, noteId);
	}

	// ── Attachments ───────────────────────────────────────────

	async getNoteAttachments(noteId: string): Promise<AttachmentSummary[]> {
		return queryNoteAttachments(this.database, noteId);
	}

	async uploadAttachment(noteId: string, file: File): Promise<{ id: string }> {
		const formData = new FormData();
		formData.append('file', file);
		const response = await fetch(`/api/notes/${noteId}/attachments`, {
			method: 'POST',
			body: formData
		});
		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			throw new Error(`Upload attachment failed (${response.status}): ${errorText}`);
		}
		return response.json() as Promise<{ id: string }>;
	}

	async deleteAttachment(attachmentId: string): Promise<void> {
		return mutateDeleteAttachment(this.database, attachmentId);
	}

	// ── Note-Time Entry Links ─────────────────────────────────

	async getNoteTimeEntries(noteId: string): Promise<NoteTimeEntryLink[]> {
		return queryNoteTimeEntries(this.database, noteId);
	}

	async unlinkNoteTimeEntry(noteId: string, timeEntryId: string): Promise<void> {
		return mutateUnlinkNoteTimeEntry(this.database, noteId, timeEntryId);
	}

	// ── Time Entries ──────────────────────────────────────────

	async getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]> {
		return Promise.all(weekStarts.map((weekStart) => this.buildWeekData(weekStart)));
	}

	async getWeekSummaries(count: number, before?: string): Promise<WeekSummary[]> {
		const beforeDate = before || new Date().toISOString().split('T')[0];
		const beforeMonday = getMondayOfWeek(beforeDate);

		const weekStarts: string[] = [];
		for (let weekOffset = 0; weekOffset < count; weekOffset++) {
			const weekDate = new Date(beforeMonday + 'T00:00:00');
			weekDate.setDate(weekDate.getDate() - weekOffset * 7);
			const year = weekDate.getFullYear();
			const month = String(weekDate.getMonth() + 1).padStart(2, '0');
			const day = String(weekDate.getDate()).padStart(2, '0');
			weekStarts.push(`${year}-${month}-${day}`);
		}

		return Promise.all(
			weekStarts.map(async (weekStart) => {
				const sunday = getSundayOfWeek(weekStart);
				const year = getIsoYear(weekStart);
				const weekNumber = getIsoWeekNumber(weekStart);

				// Sum duration_minutes for non-draft entries in this week
				const totalRow = await this.database.get<{ total: number | null }>(
					`SELECT SUM(duration_minutes) AS total
					 FROM time_entries
					 WHERE date BETWEEN ? AND ? AND is_draft = 0`,
					[weekStart, sunday]
				);

				// Look up weekly status
				const statusRows = await this.database.getAll<{ status: string }>(
					`SELECT status FROM weekly_statuses WHERE year = ? AND week_number = ?`,
					[year, weekNumber]
				);

				return {
					weekStart,
					year,
					weekNumber,
					totalMinutes: totalRow.total ?? 0,
					status: statusRows.length > 0 ? statusRows[0].status : 'Unsubmitted'
				};
			})
		);
	}

	async createTimeEntry(data: CreateTimeEntryInput): Promise<{ id: string }> {
		return mutateCreateTimeEntry(this.database, data);
	}

	async updateTimeEntry(entryId: string, data: Partial<TimeEntryFields>): Promise<void> {
		return mutateUpdateTimeEntry(this.database, entryId, data);
	}

	async deleteTimeEntry(entryId: string): Promise<void> {
		return mutateDeleteTimeEntry(this.database, entryId);
	}

	async updateWeeklyStatus(year: number, weekNumber: number, status: string): Promise<void> {
		return mutateUpdateWeeklyStatus(this.database, year, weekNumber, status);
	}

	// ── Timer ─────────────────────────────────────────────────

	async getTimerStatus(): Promise<TimerStatus> {
		const timer = await queryTimerStatus(this.database);
		return { timer };
	}

	async startTimer(contractId?: string): Promise<TimerEntry> {
		return mutateStartTimer(this.database, contractId);
	}

	async stopTimer(): Promise<TimerEntry> {
		return mutateStopTimer(this.database);
	}

	async saveTimer(data: SaveTimerInput): Promise<void> {
		return mutateSaveTimer(this.database, data);
	}

	async discardTimer(entryId: string): Promise<void> {
		return mutateDiscardTimer(this.database, entryId);
	}

	// ── Deliverables & Work Types ─────────────────────────────

	async getDeliverables(contractId: string): Promise<DeliverableOption[]> {
		return queryDeliverables(this.database, contractId);
	}

	async getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]> {
		return queryWorkTypes(this.database, deliverableId);
	}

	// ── Private Helpers ───────────────────────────────────────

	/**
	 * Build a full WeekData object for a single week by querying
	 * time entries with joined contract/client/deliverable/workType names,
	 * then grouping into days.
	 */
	private async buildWeekData(weekStart: string): Promise<WeekData> {
		const sunday = getSundayOfWeek(weekStart);
		const year = getIsoYear(weekStart);
		const weekNumber = getIsoWeekNumber(weekStart);

		// Fetch non-draft time entries for this week with joined context
		const rows = await this.database.getAll<{
			id: string;
			start_time: string | null;
			end_time: string | null;
			duration_minutes: number;
			contract_id: string;
			contract_name: string;
			client_name: string;
			client_short_code: string;
			deliverable_name: string | null;
			work_type_name: string | null;
			description: string | null;
			date: string;
		}>(
			`SELECT
				te.id,
				te.start_time,
				te.end_time,
				te.duration_minutes,
				te.contract_id,
				c.name AS contract_name,
				cl.name AS client_name,
				cl.short_code AS client_short_code,
				d.name AS deliverable_name,
				wt.name AS work_type_name,
				te.description,
				te.date
			FROM time_entries te
			JOIN contracts c ON c.id = te.contract_id
			JOIN clients cl ON cl.id = c.client_id
			LEFT JOIN deliverables d ON d.id = te.deliverable_id
			LEFT JOIN work_types wt ON wt.id = te.work_type_id
			WHERE te.date BETWEEN ? AND ? AND te.is_draft = 0
			ORDER BY te.start_time ASC NULLS LAST, te.created_at ASC`,
			[weekStart, sunday]
		);

		// Map rows to TimeEntryDisplay objects
		const entries: TimeEntryDisplay[] = rows.map((row) => ({
			id: row.id,
			startTime: row.start_time,
			endTime: row.end_time,
			durationMinutes: row.duration_minutes,
			contractId: row.contract_id,
			contractName: row.contract_name,
			clientName: row.client_name,
			clientShortCode: row.client_short_code,
			deliverableName: row.deliverable_name,
			workTypeName: row.work_type_name,
			description: row.description,
			date: row.date
		}));

		// Group entries by date into all 7 days
		const weekDates = getWeekDates(weekStart);
		const entriesByDate = new Map<string, TimeEntryDisplay[]>();
		for (const entry of entries) {
			const dateEntries = entriesByDate.get(entry.date) ?? [];
			dateEntries.push(entry);
			entriesByDate.set(entry.date, dateEntries);
		}

		const days: DayData[] = weekDates.map((date) => {
			const dayEntries = entriesByDate.get(date) ?? [];
			const totalMinutes = dayEntries.reduce(
				(accumulator, entry) => accumulator + entry.durationMinutes,
				0
			);
			return { date, entries: dayEntries, totalMinutes };
		});

		const weeklyTotalMinutes = days.reduce(
			(accumulator, day) => accumulator + day.totalMinutes,
			0
		);

		// Look up weekly status
		const statusRows = await this.database.getAll<{ status: string }>(
			`SELECT status FROM weekly_statuses WHERE year = ? AND week_number = ?`,
			[year, weekNumber]
		);

		return {
			weekStart,
			days,
			weeklyTotalMinutes,
			status: statusRows.length > 0 ? statusRows[0].status : 'Unsubmitted'
		};
	}
}
