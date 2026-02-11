/**
 * PowerSync Database Initialization
 *
 * Creates and manages the PowerSync database singleton.
 * Must only be called client-side (browser/Tauri webview).
 *
 * Connects to the ChronologConnector for server-side sync
 * (push local changes, pull remote changes).
 */

import type { PowerSyncDatabase as PowerSyncDatabaseType } from '@powersync/web';

let powerSyncInstance: PowerSyncDatabaseType | null = null;
let connectionPromise: Promise<PowerSyncDatabaseType> | null = null;

/**
 * Connect to PowerSync with the backend connector.
 *
 * Creates a new PowerSyncDatabase instance, wires up the
 * ChronologConnector, and starts syncing. Returns the connected
 * database. This is idempotent — subsequent calls return the
 * same instance.
 */
export async function connectPowerSync(): Promise<PowerSyncDatabaseType> {
	if (powerSyncInstance) {
		return powerSyncInstance;
	}

	if (connectionPromise) {
		return connectionPromise;
	}

	connectionPromise = createAndConnectDatabase();
	powerSyncInstance = await connectionPromise;

	return powerSyncInstance;
}

async function createAndConnectDatabase(): Promise<PowerSyncDatabaseType> {
	// Dynamic imports — ensures this code only loads client-side
	const { PowerSyncDatabase } = await import('@powersync/web');
	const { AppSchema } = await import('./schema');
	const { ChronologConnector } = await import('./connector');

	const sharedWorkerAvailable = typeof SharedWorker !== 'undefined';

	const database = new PowerSyncDatabase({
		schema: AppSchema,
		database: {
			dbFilename: 'chronolog.db'
		},
		flags: {
			enableMultiTabs: sharedWorkerAvailable
		}
	});

	const connector = new ChronologConnector();
	await database.connect(connector);

	return database;
}

/**
 * Get the PowerSync database singleton.
 *
 * If the database has not been initialized yet, this will
 * call `connectPowerSync()` to create and connect it.
 */
export async function getPowerSyncDatabase(): Promise<PowerSyncDatabaseType> {
	if (powerSyncInstance) {
		return powerSyncInstance;
	}

	return connectPowerSync();
}

/**
 * Disconnect and tear down the PowerSync database.
 *
 * Closes the underlying connection and resets the singleton
 * so the next call to `connectPowerSync()` or
 * `getPowerSyncDatabase()` will create a fresh instance.
 */
export async function disconnectPowerSync(): Promise<void> {
	if (powerSyncInstance) {
		await powerSyncInstance.disconnectAndClear();
		await powerSyncInstance.close();
		powerSyncInstance = null;
		connectionPromise = null;
	}
}
