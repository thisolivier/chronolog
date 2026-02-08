/**
 * Data Service Context — Svelte Context Helpers
 *
 * Provides typed getContext/setContext wrappers for the SyncedDataService.
 * Components use getDataService() to access the service without prop drilling.
 */

import { getContext, setContext } from 'svelte';
import type { SyncedDataService } from './synced-data-service.svelte';

const DATA_SERVICE_KEY = 'dataService';

/**
 * Set the SyncedDataService in Svelte context.
 * Called once in the root layout during component initialization.
 */
export function setDataServiceContext(service: SyncedDataService): void {
	setContext(DATA_SERVICE_KEY, service);
}

/**
 * Get the SyncedDataService from Svelte context.
 * Must be called during component initialization (not in async callbacks).
 */
export function getDataService(): SyncedDataService {
	return getContext<SyncedDataService>(DATA_SERVICE_KEY);
}
