/**
 * PowerSync Database Initialization
 *
 * Creates and manages the PowerSync database instance.
 * Must only be called client-side (browser/Tauri webview).
 *
 * For the spike, we initialize without a server connection
 * to validate that local SQLite (OPFS/wa-sqlite) works.
 */

import type { PowerSyncDatabase as PowerSyncDatabaseType } from '@powersync/web';

let database: PowerSyncDatabaseType | null = null;
let initializationPromise: Promise<PowerSyncDatabaseType> | null = null;

export type PowerSyncInitResult = {
	database: PowerSyncDatabaseType;
	storageType: string;
	diagnostics: {
		opfsAvailable: boolean;
		sharedWorkerAvailable: boolean;
		userAgent: string;
	};
};

/**
 * Detect which storage features are available in the current environment.
 */
function detectCapabilities() {
	return {
		opfsAvailable: typeof navigator !== 'undefined' && 'storage' in navigator,
		sharedWorkerAvailable: typeof SharedWorker !== 'undefined',
		userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
	};
}

/**
 * Initialize the PowerSync database.
 * Returns the database instance plus diagnostic info about the storage backend.
 *
 * This is a singleton — calling it multiple times returns the same instance.
 */
export async function initPowerSync(): Promise<PowerSyncInitResult> {
	if (database) {
		return {
			database,
			storageType: 'cached',
			diagnostics: detectCapabilities()
		};
	}

	if (initializationPromise) {
		const existingDatabase = await initializationPromise;
		return {
			database: existingDatabase,
			storageType: 'cached',
			diagnostics: detectCapabilities()
		};
	}

	initializationPromise = createDatabase();
	const newDatabase = await initializationPromise;
	database = newDatabase;

	return {
		database: newDatabase,
		storageType: 'fresh',
		diagnostics: detectCapabilities()
	};
}

async function createDatabase(): Promise<PowerSyncDatabaseType> {
	// Dynamic import — ensures this code only loads client-side
	const { PowerSyncDatabase } = await import('@powersync/web');
	const { AppSchema } = await import('./schema');

	const diagnostics = detectCapabilities();

	const powerSyncDatabase = new PowerSyncDatabase({
		schema: AppSchema,
		database: {
			dbFilename: 'chronolog-spike.db'
		},
		flags: {
			enableMultiTabs: diagnostics.sharedWorkerAvailable
		}
	});

	return powerSyncDatabase;
}

/**
 * Get the current database instance (null if not initialized).
 */
export function getPowerSyncDatabase(): PowerSyncDatabaseType | null {
	return database;
}

/**
 * Close and reset the database instance.
 */
export async function closePowerSync(): Promise<void> {
	if (database) {
		await database.close();
		database = null;
		initializationPromise = null;
	}
}
