/**
 * A DataService wrapper that delegates all calls to a mutable inner service.
 *
 * This allows swapping the underlying implementation at runtime (e.g.,
 * starting with FetchDataService and switching to PowerSyncDataService
 * once the async connection completes) without re-setting Svelte context
 * or updating component references.
 */

import type { DataService } from './data-service';
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

	createContract(data: CreateContractInput): Promise<{ id: string }> {
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

	createNote(contractId: string): Promise<NoteSummary> {
		return this.delegate.createNote(contractId);
	}

	updateNote(noteId: string, data: UpdateNoteInput): Promise<NoteDetail> {
		return this.delegate.updateNote(noteId, data);
	}

	deleteNote(noteId: string): Promise<void> {
		return this.delegate.deleteNote(noteId);
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

	getNoteTimeEntries(noteId: string): Promise<NoteTimeEntryLink[]> {
		return this.delegate.getNoteTimeEntries(noteId);
	}

	unlinkNoteTimeEntry(noteId: string, timeEntryId: string): Promise<void> {
		return this.delegate.unlinkNoteTimeEntry(noteId, timeEntryId);
	}

	// ── Time Entries ──────────────────────────────────────────

	getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]> {
		return this.delegate.getWeeklyTimeEntries(weekStarts);
	}

	getWeekSummaries(count: number, before?: string): Promise<WeekSummary[]> {
		return this.delegate.getWeekSummaries(count, before);
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

	startTimer(contractId?: string): Promise<TimerEntry> {
		return this.delegate.startTimer(contractId);
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
