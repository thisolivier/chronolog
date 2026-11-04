// ============================================================
// Shared types for the DataService abstraction layer
// ============================================================

// -- Contracts --

export type ContractsByClientResult = {
	id: string;
	name: string;
	isActive: boolean;
	clientId: string;
	clientName: string;
	clientShortCode: string;
	clientEmoji: string | null;
	clientColorIndex: number;
	/** The client's manual sidebar position (sprint 039-CL); clients sort by it, then by name */
	clientSortOrder?: number;
	noteCount: number;
	/** Only with `includeArchived` (sprint 031-CL): the contract, or its client, is archived */
	archived?: boolean;
	clientArchived?: boolean;
};

export type ContractOption = {
	id: string;
	name: string;
	isActive: boolean;
	clientId: string;
	clientName: string;
	clientShortCode: string;
	clientColorIndex: number;
};

export type CreateContractInput = {
	/** An existing client, or omit it and pass `newClient` to create one in the same request. */
	clientId?: string;
	newClient?: { name: string; shortCode: string };
	name: string;
	description?: string | null;
	isActive?: boolean;
};

// -- Clients --

export type ClientSummary = {
	id: string;
	name: string;
	shortCode: string;
	colorIndex?: number;
};

// -- Notes --

export type NoteSummary = {
	id: string;
	contractId: string;
	isPinned: boolean;
	/** When it was pinned (sprint 039-CL): pinned notes sort first, most recently pinned on top */
	pinnedAt?: string | null;
	createdAt: string;
	updatedAt: string;
	firstLine: string;
	secondLine: string;
};

/** `PUT /api/notes/[id]/pin` answer (sprint 039-CL) */
export type NotePinState = {
	id: string;
	contractId: string;
	isPinned: boolean;
	pinnedAt: string | null;
};

export type NoteDetail = {
	id: string;
	title: string | null;
	content: string | null;
	contentJson: string | null;
	contractId: string;
	wordCount: number;
	isPinned: boolean;
	pinnedAt?: string | null;
	createdAt: string;
	updatedAt: string;
};

export type UpdateNoteInput = {
	/** The `updatedAt` the client last saw; the server answers 409 if the note changed since */
	expectedUpdatedAt?: string;
	title?: string;
	content?: string;
	contentJson?: string;
	isPinned?: boolean;
	contractId?: string;
};

export type Backlink = {
	sourceNoteId: string;
	/** Display title: stored title, else first content line */
	noteTitle: string | null;
	headingAnchor: string | null;
	noteContractId?: string;
	noteClientId?: string;
};

export type CreateNoteInput = {
	title?: string;
	content?: string;
	contentJson?: string;
};

export type UpdateNoteOptions = {
	/** Send with `fetch(..., { keepalive: true })` so the save survives page unload */
	keepalive?: boolean;
};

export type NoteSearchOptions = {
	excludeNoteId?: string;
	limit?: number;
	/** With an empty query, return the most recently edited notes */
	recent?: boolean;
};

export type NoteSearchResult = {
	id: string;
	title: string | null;
	displayTitle: string | null;
	contractId: string;
	contractName: string;
	clientId: string;
	clientName: string;
	clientShortCode: string;
	firstLine: string;
	secondLine: string;
	updatedAt: string;
};

export type NoteTitleInfo = {
	id: string;
	displayTitle: string | null;
	contractId: string;
	clientId: string;
	/** Only with `includeDeleted`: set while the note is in the trash */
	deletedAt?: string | null;
};

/** `POST /api/notes/[noteId]/restore` (sprint 037-CL); the contract may be archived */
export type RestoredNote = {
	note: NoteDetail;
	contract: { id: string; name: string; clientShortCode: string; archived: boolean; isSystem: boolean } | null;
};

// -- Attachments --

export type AttachmentSummary = {
	id: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
};

// -- Note-Time Entry Links --

export type NoteTimeEntryLink = {
	noteId: string;
	timeEntryId: string;
	headingAnchor: string | null;
};

export type LinkedTimeEntryDisplay = {
	timeEntryId: string;
	noteId: string;
	headingAnchor: string | null;
	date: string;
	description: string | null;
	durationMinutes: number;
	contractName: string;
	clientName: string;
	clientColorIndex: number;
};

// -- Time Entries --

export type TimeEntryFields = {
	contractId: string;
	deliverableId: string | null;
	workTypeId: string | null;
	date: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
	description: string | null;
};

export type CreateTimeEntryInput = {
	date: string;
	durationMinutes: number;
	contractId: string;
	deliverableId?: string | null;
	workTypeId?: string | null;
	description?: string;
	startTime?: string;
	endTime?: string;
};

export type WeekData = {
	weekStart: string;
	days: DayData[];
	weeklyTotalMinutes: number;
	status: string;
};

export type DayData = {
	date: string;
	entries: TimeEntryDisplay[];
	totalMinutes: number;
};

export type TimeEntryDisplay = {
	id: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
	contractId: string;
	contractName: string;
	/** Optional only until the PowerSync client (which does not map it) is removed in 021-CL */
	clientId?: string;
	clientName: string;
	clientShortCode: string;
	clientColorIndex: number;
	deliverableId?: string | null;
	deliverableName: string | null;
	workTypeId?: string | null;
	workTypeName: string | null;
	description: string | null;
	date: string;
};

// -- Timer --

export type TimerStatus = {
	timer: TimerEntry | null;
};

export type TimerEntry = {
	id: string;
	/** Local date (YYYY-MM-DD) the timer was started on */
	date?: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
	/** Draft contract chosen while the timer ran (restored after a reload) */
	contractId?: string | null;
	deliverableId?: string | null;
	workTypeId?: string | null;
	description?: string | null;
};

/** When a timer really started, by the browser's clock (it may predate the server draft) */
export type TimerLocalStart = { date: string; startTime: string };

export type SaveTimerInput = {
	entryId: string;
	contractId: string;
	deliverableId: string;
	workTypeId: string;
	description: string;
	/** Adjusted time from the completion form; omitted to keep what the timer measured */
	durationMinutes?: number;
	startTime?: string | null;
	endTime?: string | null;
};

// -- Deliverables & Work Types --

export type DeliverableOption = {
	id: string;
	name: string;
};

export type WorkTypeOption = {
	id: string;
	name: string;
};
