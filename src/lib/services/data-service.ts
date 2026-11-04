import type {
	TimerLocalStart,
	ContractsByClientResult,
	ContractOption,
	CreateContractInput,
	ClientSummary,
	NoteSummary,
	NoteDetail,
	NotePinState,
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

export interface DataService {
	// Contracts
	getContractsByClient(): Promise<ContractsByClientResult[]>;
	getContracts(): Promise<ContractOption[]>;
	createContract(data: CreateContractInput): Promise<{ id: string; clientId: string }>;

	// Clients
	getClients(): Promise<ClientSummary[]>;
	/** Persist the sidebar's client order; unlisted clients (archived) follow (sprint 039-CL) */
	reorderClients(orderedClientIds: string[]): Promise<void>;

	// Notes
	getNotesForContract(contractId: string): Promise<NoteSummary[]>;
	/** Every note of a client's contracts, pinned first (the client view, sprint 039-CL) */
	getNotesForClient(clientId: string): Promise<NoteSummary[]>;
	/** Pin or unpin; does not change the note's `updatedAt` (sprint 039-CL) */
	setNotePinned(noteId: string, pinned: boolean): Promise<NotePinState>;
	getNoteById(noteId: string): Promise<NoteDetail>;
	createNote(contractId: string, initial?: CreateNoteInput): Promise<NoteSummary>;
	updateNote(noteId: string, data: UpdateNoteInput, options?: UpdateNoteOptions): Promise<NoteDetail>;
	searchNotes(query: string, options?: NoteSearchOptions): Promise<NoteSearchResult[]>;
	getNoteTitles(noteIds: string[]): Promise<NoteTitleInfo[]>;
	/** Moves the note to the server-side trash (sprint 037-CL) */
	deleteNote(noteId: string): Promise<void>;
	restoreNote(noteId: string): Promise<RestoredNote>;
	getNoteBacklinks(noteId: string): Promise<Backlink[]>;

	// Attachments
	getNoteAttachments(noteId: string): Promise<AttachmentSummary[]>;
	uploadAttachment(noteId: string, file: File): Promise<{ id: string }>;
	deleteAttachment(attachmentId: string): Promise<void>;

	// Note-Time Entry Links
	getNoteTimeEntries(noteId: string): Promise<LinkedTimeEntryDisplay[]>;
	linkNoteTimeEntry(noteId: string, timeEntryId: string, headingAnchor?: string): Promise<void>;
	unlinkNoteTimeEntry(noteId: string, timeEntryId: string): Promise<void>;

	// Time Entries
	getWeeklyTimeEntries(weekStarts: string[]): Promise<WeekData[]>;
	createTimeEntry(data: CreateTimeEntryInput): Promise<{ id: string }>;
	updateTimeEntry(entryId: string, data: Partial<TimeEntryFields>): Promise<void>;
	deleteTimeEntry(entryId: string): Promise<void>;
	updateWeeklyStatus(year: number, weekNumber: number, status: string): Promise<void>;

	// Timer
	getTimerStatus(): Promise<TimerStatus>;
	/** Creates the server draft; the contract is required (never guessed) */
	startTimer(contractId: string, localStart?: TimerLocalStart): Promise<TimerEntry>;
	/** Move the running timer's start (PATCH /api/timer); a 409 `start_overlaps_entry` needs `confirmed` */
	adjustTimerStart(start: TimerLocalStart, options?: { confirmed?: boolean }): Promise<TimerEntry>;
	stopTimer(): Promise<TimerEntry>;
	saveTimer(data: SaveTimerInput): Promise<void>;
	discardTimer(entryId: string): Promise<void>;

	// Deliverables & Work Types
	getDeliverables(contractId: string): Promise<DeliverableOption[]>;
	getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]>;
}
