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

export interface DataService {
	// Contracts
	getContractsByClient(): Promise<ContractsByClientResult[]>;
	getContracts(): Promise<ContractOption[]>;
	createContract(data: CreateContractInput): Promise<{ id: string }>;

	// Clients
	getClients(): Promise<ClientSummary[]>;

	// Notes
	getNotesForContract(contractId: string): Promise<NoteSummary[]>;
	getNoteById(noteId: string): Promise<NoteDetail>;
	createNote(contractId: string): Promise<NoteSummary>;
	updateNote(noteId: string, data: UpdateNoteInput): Promise<NoteDetail>;
	deleteNote(noteId: string): Promise<void>;
	getNoteBacklinks(noteId: string): Promise<Backlink[]>;

	// Attachments
	getNoteAttachments(noteId: string): Promise<AttachmentSummary[]>;
	uploadAttachment(noteId: string, file: File): Promise<{ id: string }>;
	deleteAttachment(attachmentId: string): Promise<void>;

	// Note-Time Entry Links
	getNoteTimeEntries(noteId: string): Promise<NoteTimeEntryLink[]>;
	unlinkNoteTimeEntry(noteId: string, timeEntryId: string): Promise<void>;

	// Time Entries
	getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]>;
	getWeekSummaries(count: number, before?: string): Promise<WeekSummary[]>;
	createTimeEntry(data: CreateTimeEntryInput): Promise<{ id: string }>;
	updateTimeEntry(entryId: string, data: Partial<TimeEntryFields>): Promise<void>;
	deleteTimeEntry(entryId: string): Promise<void>;
	updateWeeklyStatus(year: number, weekNumber: number, status: string): Promise<void>;

	// Timer
	getTimerStatus(): Promise<TimerStatus>;
	startTimer(contractId?: string): Promise<TimerEntry>;
	stopTimer(): Promise<TimerEntry>;
	saveTimer(data: SaveTimerInput): Promise<void>;
	discardTimer(entryId: string): Promise<void>;

	// Deliverables & Work Types
	getDeliverables(contractId: string): Promise<DeliverableOption[]>;
	getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]>;
}
