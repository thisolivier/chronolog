/**
 * Storage module entry point.
 *
 * Detects the current platform (Tauri desktop vs PWA/browser) and returns
 * the appropriate StorageAdapter. UI code imports from here:
 *
 *   import { getStorage } from '$lib/storage';
 *   const storage = await getStorage();
 */

export type { StorageAdapter, TableName, TableRowMap, SyncQueueItem } from './types';
export type {
	ClientRow,
	ContractRow,
	DeliverableRow,
	WorkTypeRow,
	TimeEntryRow,
	NoteRow,
	NoteLinkRow,
	NoteTimeEntryRow,
	WeeklyStatusRow,
	AttachmentRow
} from './types';

import type { StorageAdapter } from './types';

/**
 * Detect whether the app is running inside a Tauri desktop shell.
 */
export function isTauriEnvironment(): boolean {
	return typeof window !== 'undefined' && '__TAURI__' in window;
}

let adapterInstance: StorageAdapter | null = null;

/**
 * Get the storage adapter for the current platform.
 *
 * Lazily creates and initializes the adapter on first call.
 * Subsequent calls return the same instance.
 *
 * - Tauri desktop → SqliteAdapter (tauri-plugin-sql)
 * - PWA / browser → DexieAdapter  (IndexedDB via Dexie.js)
 */
export async function getStorage(): Promise<StorageAdapter> {
	if (adapterInstance) {
		return adapterInstance;
	}

	if (isTauriEnvironment()) {
		const { SqliteAdapter } = await import('./sqlite-adapter');
		adapterInstance = new SqliteAdapter();
	} else {
		const { DexieAdapter } = await import('./dexie-adapter');
		adapterInstance = new DexieAdapter();
	}

	await adapterInstance.init();
	return adapterInstance;
}

/**
 * Reset the storage singleton (useful for testing).
 */
export async function resetStorage(): Promise<void> {
	if (adapterInstance) {
		await adapterInstance.close();
		adapterInstance = null;
	}
}
