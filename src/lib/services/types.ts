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
	noteCount: number;
};

export type ContractOption = {
	id: string;
	name: string;
	isActive: boolean;
	clientId: string;
	clientName: string;
	clientShortCode: string;
};

export type CreateContractInput = {
	clientId: string;
	name: string;
	description?: string | null;
	isActive?: boolean;
};

// -- Clients --

export type ClientSummary = {
	id: string;
	name: string;
	shortCode: string;
};

// -- Notes --

export type NoteSummary = {
	id: string;
	contractId: string;
	isPinned: boolean;
	createdAt: string;
	updatedAt: string;
	firstLine: string;
	secondLine: string;
};

export type NoteDetail = {
	id: string;
	title: string | null;
	content: string | null;
	contentJson: string | null;
	contractId: string;
	wordCount: number;
	isPinned: boolean;
	createdAt: string;
	updatedAt: string;
};

export type UpdateNoteInput = {
	title?: string;
	content?: string;
	contentJson?: string;
	isPinned?: boolean;
};

export type Backlink = {
	sourceNoteId: string;
	noteTitle: string | null;
	headingAnchor: string | null;
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
	clientName: string;
	clientShortCode: string;
	deliverableName: string | null;
	workTypeName: string | null;
	description: string | null;
	date: string;
};

export type WeekSummary = {
	weekStart: string;
	year: number;
	weekNumber: number;
	totalMinutes: number;
	status: string;
};

// -- Timer --

export type TimerStatus = {
	timer: TimerEntry | null;
};

export type TimerEntry = {
	id: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
};

export type SaveTimerInput = {
	entryId: string;
	contractId: string;
	deliverableId: string;
	workTypeId: string;
	description: string;
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
