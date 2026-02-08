/**
 * Data Types — Shapes returned by SyncedDataService methods.
 *
 * These types match what the existing UI components expect from the
 * server API responses. The data service returns these types regardless
 * of whether the data came from the server (online) or local storage
 * (offline).
 */

// ---------------------------------------------------------------------------
// Contracts sidebar
// ---------------------------------------------------------------------------

export interface ContractsByClientResult {
	id: string;
	name: string;
	isActive: boolean;
	sortOrder: number;
	clientId: string;
	clientName: string;
	clientShortCode: string;
	noteCount: number;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export interface NoteSummary {
	id: string;
	contractId: string;
	isPinned: boolean;
	createdAt: string;
	updatedAt: string;
	firstLine: string;
	secondLine: string;
}

export interface NoteDetail {
	id: string;
	title: string | null;
	content: string | null;
	contentJson: string | null;
	contractId: string;
	wordCount: number;
	isPinned: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface NoteUpdateData {
	title?: string;
	content?: string;
	contentJson?: string;
}

// ---------------------------------------------------------------------------
// Time entries
// ---------------------------------------------------------------------------

export interface WeekData {
	weekStart: string;
	days: DayData[];
	weeklyTotalMinutes: number;
	status: string;
}

export interface DayData {
	date: string;
	entries: TimeEntryDisplay[];
	totalMinutes: number;
}

export interface TimeEntryDisplay {
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
}

export interface TimeEntryCreateData {
	date: string;
	durationMinutes: number;
	contractId: string;
	description?: string;
}

export interface TimeEntryUpdateData {
	contractId?: string;
	deliverableId?: string | null;
	workTypeId?: string | null;
	description?: string;
	durationMinutes?: number;
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

export interface TimerEntry {
	id: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
}

export interface TimerSaveData {
	contractId: string;
	deliverableId: string;
	workTypeId: string;
	description: string;
}
