/**
 * Sync Module — Public API
 *
 * Entry point for the client-side sync engine. Import from '$lib/sync'
 * to access the sync engine, queue, metadata, online status, and the
 * main SyncedDataService that bridges UI components to the data layer.
 */

export { SyncEngine } from './sync-engine.svelte';
export { SyncQueue } from './sync-queue';
export { SyncMetadata } from './sync-metadata';
export { SyncedDataService } from './synced-data-service.svelte';
export { createOnlineStatus, type OnlineStatus } from './online-status.svelte';
export { setDataServiceContext, getDataService } from './context';
export {
	pullFromServer,
	pushToServer,
	SyncAuthError,
	SyncNetworkError,
	SyncServerError,
	type FetchFunction
} from './sync-fetcher';
export type {
	PendingMutation,
	SyncState,
	SyncResult,
	PullResult,
	PushResult,
	SyncPullResponse,
	SyncPushRequest,
	SyncPushResponse,
	SyncMutation,
	SyncTableName
} from './types';
export type {
	ContractsByClientResult,
	NoteSummary,
	NoteDetail,
	NoteUpdateData,
	WeekData,
	DayData,
	TimeEntryDisplay,
	TimeEntryCreateData,
	TimeEntryUpdateData,
	TimerEntry,
	TimerSaveData
} from './data-types';
