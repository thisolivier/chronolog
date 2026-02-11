// Public API for the services module
export type { DataService } from './data-service';
export { FetchDataService } from './fetch-data-service';
export { DelegatingDataService } from './delegating-data-service';
export { setDataServiceContext, getDataService } from './context';

// Re-export all types
export type {
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
	DayData,
	TimeEntryDisplay,
	WeekSummary,
	TimerStatus,
	TimerEntry,
	SaveTimerInput,
	DeliverableOption,
	WorkTypeOption
} from './types';
