/**
 * A DataService wrapper that delegates all calls to a mutable inner service.
 *
 * This allows swapping the underlying implementation at runtime via
 * setDelegate() without re-setting Svelte context or updating component
 * references. Today the only delegate is FetchDataService.
 */

import type { DataService } from './data-service';
import { announceNotesChanged } from './notes-changed-event';
import type { TimerLocalStart,
	ContractsByClientResult,
	ContractOption,
	CreateContractInput,
	ClientSummary,
	NoteSummary,
	NoteDetail,
	UpdateNoteInput,
	UpdateNoteOptions,
	CreateNoteInput,
	NoteSearchOptions,
	NoteSearchResult,
	NoteTitleInfo,
	RestoredNote,
	Backlink,
	AttachmentSummary,
	LinkedTimeEntryDisplay,
	TimeEntryFields,
	CreateTimeEntryInput,
	WeekData,
	TimerStatus,
	TimerEntry,
	SaveTimerInput,
	DeliverableOption,
	WorkTypeOption
} from './types';

export class DelegatingDataService implements DataService {
	private delegate: DataService;

	constructor(initialDelegate: DataService) {
		this.delegate = initialDelegate;
	}

	/** Swap the underlying service implementation. */
	setDelegate(newDelegate: DataService): void {
		this.delegate = newDelegate;
	}

	// ── Contracts ─────────────────────────────────────────────

	getContractsByClient(): Promise<ContractsByClientResult[]> {
		return this.delegate.getContractsByClient();
	}

	getContracts(): Promise<ContractOption[]> {
		return this.delegate.getContracts();
	}

	createContract(data: CreateContractInput): Promise<{ id: string; clientId: string }> {
		return this.delegate.createContract(data);
	}

	// ── Clients ───────────────────────────────────────────────

	getClients(): Promise<ClientSummary[]> {
		return this.delegate.getClients();
	}

	// ── Notes ─────────────────────────────────────────────────

	getNotesForContract(contractId: string): Promise<NoteSummary[]> {
		return this.delegate.getNotesForContract(contractId);
	}

	getNoteById(noteId: string): Promise<NoteDetail> {
		return this.delegate.getNoteById(noteId);
	}

	async createNote(contractId: string, initial?: CreateNoteInput): Promise<NoteSummary> {
		const note = await this.delegate.createNote(contractId, initial);
		announceNotesChanged();
		return note;
	}

	async updateNote(noteId: string, data: UpdateNoteInput, options?: UpdateNoteOptions): Promise<NoteDetail> {
		const note = await this.delegate.updateNote(noteId, data, options);
		// Only a move changes per-contract counts; ordinary autosaves do not
		if ('contractId' in data && data.contractId) announceNotesChanged();
		return note;
	}

	searchNotes(query: string, options?: NoteSearchOptions): Promise<NoteSearchResult[]> {
		return this.delegate.searchNotes(query, options);
	}

	getNoteTitles(noteIds: string[]): Promise<NoteTitleInfo[]> {
		return this.delegate.getNoteTitles(noteIds);
	}

	async deleteNote(noteId: string): Promise<void> {
		await this.delegate.deleteNote(noteId);
		announceNotesChanged();
	}

	async restoreNote(noteId: string): Promise<RestoredNote> {
		const restored = await this.delegate.restoreNote(noteId);
		announceNotesChanged();
		return restored;
	}

	getNoteBacklinks(noteId: string): Promise<Backlink[]> {
		return this.delegate.getNoteBacklinks(noteId);
	}

	// ── Attachments ───────────────────────────────────────────

	getNoteAttachments(noteId: string): Promise<AttachmentSummary[]> {
		return this.delegate.getNoteAttachments(noteId);
	}

	uploadAttachment(noteId: string, file: File): Promise<{ id: string }> {
		return this.delegate.uploadAttachment(noteId, file);
	}

	deleteAttachment(attachmentId: string): Promise<void> {
		return this.delegate.deleteAttachment(attachmentId);
	}

	// ── Note-Time Entry Links ─────────────────────────────────

	getNoteTimeEntries(noteId: string): Promise<LinkedTimeEntryDisplay[]> {
		return this.delegate.getNoteTimeEntries(noteId);
	}

	linkNoteTimeEntry(noteId: string, timeEntryId: string, headingAnchor?: string): Promise<void> {
		return this.delegate.linkNoteTimeEntry(noteId, timeEntryId, headingAnchor);
	}

	unlinkNoteTimeEntry(noteId: string, timeEntryId: string): Promise<void> {
		return this.delegate.unlinkNoteTimeEntry(noteId, timeEntryId);
	}

	// ── Time Entries ──────────────────────────────────────────

	getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]> {
		return this.delegate.getWeeklyTimeEntries(weekStarts);
	}

	createTimeEntry(data: CreateTimeEntryInput): Promise<{ id: string }> {
		return this.delegate.createTimeEntry(data);
	}

	updateTimeEntry(entryId: string, data: Partial<TimeEntryFields>): Promise<void> {
		return this.delegate.updateTimeEntry(entryId, data);
	}

	deleteTimeEntry(entryId: string): Promise<void> {
		return this.delegate.deleteTimeEntry(entryId);
	}

	updateWeeklyStatus(year: number, weekNumber: number, status: string): Promise<void> {
		return this.delegate.updateWeeklyStatus(year, weekNumber, status);
	}

	// ── Timer ─────────────────────────────────────────────────

	getTimerStatus(): Promise<TimerStatus> {
		return this.delegate.getTimerStatus();
	}

	startTimer(contractId: string, localStart?: TimerLocalStart): Promise<TimerEntry> {
		return this.delegate.startTimer(contractId, localStart);
	}

	stopTimer(): Promise<TimerEntry> {
		return this.delegate.stopTimer();
	}

	saveTimer(data: SaveTimerInput): Promise<void> {
		return this.delegate.saveTimer(data);
	}

	discardTimer(entryId: string): Promise<void> {
		return this.delegate.discardTimer(entryId);
	}

	// ── Deliverables & Work Types ─────────────────────────────

	getDeliverables(contractId: string): Promise<DeliverableOption[]> {
		return this.delegate.getDeliverables(contractId);
	}

	getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]> {
		return this.delegate.getWorkTypes(deliverableId);
	}
}
