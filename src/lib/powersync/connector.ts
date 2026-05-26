/**
 * PowerSync Backend Connector
 *
 * Bridges the PowerSync client with the Chronolog server.
 * Implements two responsibilities:
 *
 * 1. fetchCredentials() — obtains a JWT from /api/powersync/token
 *    so the PowerSync client can authenticate with the sync service.
 *
 * 2. uploadData() — processes the local CRUD queue and forwards
 *    each change to the appropriate REST API endpoint.
 */

import type {
	PowerSyncBackendConnector,
	PowerSyncCredentials,
	AbstractPowerSyncDatabase
} from '@powersync/web';
import { UpdateType } from '@powersync/web';
import { fetchJson, postJson, putJson, deleteRequest } from '$lib/services/fetch-helpers';

const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL ?? 'http://localhost:8080';
const CRUD_BATCH_SIZE = 100;

/** Shape returned by /api/powersync/token */
interface TokenResponse {
	token: string;
	expiresAt: string;
}

/**
 * Per-table configuration for the REST upload mapping.
 *
 * Tables not listed here are logged as warnings and skipped —
 * they are either managed server-side (note_links, note_time_entries)
 * or do not yet have a CRUD API (deliverables, work_types).
 */
interface TableApiConfig {
	basePath: string;
	supportsPut?: boolean;
	supportsPatch?: boolean;
	supportsDelete?: boolean;
}

const TABLE_API_CONFIG: Record<string, TableApiConfig> = {
	notes: {
		basePath: '/api/notes',
		supportsPut: true,
		supportsPatch: true,
		supportsDelete: true
	},
	time_entries: {
		basePath: '/api/time-entries',
		supportsPut: true,
		supportsPatch: true,
		supportsDelete: true
	},
	clients: {
		basePath: '/api/clients',
		supportsPut: true
	},
	contracts: {
		basePath: '/api/contracts',
		supportsPut: true
	},
	weekly_statuses: {
		basePath: '/api/time-entries/weekly-statuses',
		supportsPut: true
	},
	attachments: {
		basePath: '/api/attachments',
		supportsDelete: true
	}
};

/**
 * ChronologConnector — PowerSync backend connector for the Chronolog app.
 *
 * Used by the PowerSync database to authenticate and push local
 * writes to the server.
 */
export class ChronologConnector implements PowerSyncBackendConnector {
	/**
	 * Fetch a fresh JWT for the PowerSync sync connection.
	 *
	 * Returns null if the user is not authenticated (401),
	 * which tells PowerSync to stop syncing until credentials
	 * are available again.
	 */
	async fetchCredentials(): Promise<PowerSyncCredentials | null> {
		try {
			const response = await fetchJson<TokenResponse>('/api/powersync/token');

			return {
				endpoint: POWERSYNC_URL,
				token: response.token,
				expiresAt: new Date(response.expiresAt)
			};
		} catch (error) {
			// 401 means the user is not signed in — return null so
			// PowerSync pauses sync rather than retrying endlessly.
			if (error instanceof Error && error.message.includes('401')) {
				console.warn('PowerSync: user not authenticated, pausing sync');
				return null;
			}
			throw error;
		}
	}

	/**
	 * Upload queued local changes to the server REST API.
	 *
	 * Processes batches of CRUD entries from the local queue.
	 * Each entry is mapped to the appropriate REST endpoint based
	 * on its table and operation type.
	 *
	 * Throws on fetch failures so PowerSync will retry after
	 * its configured backoff period.
	 */
	async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
		let batch = await database.getCrudBatch(CRUD_BATCH_SIZE);

		while (batch) {
			for (const entry of batch.crud) {
				await this.processEntry(entry);
			}

			await batch.complete();

			// Continue draining the queue if there are more entries
			if (batch.haveMore) {
				batch = await database.getCrudBatch(CRUD_BATCH_SIZE);
			} else {
				break;
			}
		}
	}

	/**
	 * Route a single CRUD entry to the correct REST API call.
	 *
	 * PUT  -> POST to basePath (insert / upsert)
	 * PATCH -> PUT to basePath/:id (update)
	 * DELETE -> DELETE to basePath/:id
	 */
	private async processEntry(entry: {
		table: string;
		op: UpdateType;
		id: string;
		opData?: Record<string, unknown>;
	}): Promise<void> {
		const config = TABLE_API_CONFIG[entry.table];

		if (!config) {
			console.warn(
				`PowerSync uploadData: no API config for table "${entry.table}", skipping`,
				{ op: entry.op, id: entry.id }
			);
			return;
		}

		const payload = { id: entry.id, ...entry.opData };

		switch (entry.op) {
			case UpdateType.PUT:
				if (!config.supportsPut) {
					console.warn(`PowerSync: PUT not supported for "${entry.table}", skipping`);
					return;
				}
				await postJson(config.basePath, payload);
				break;

			case UpdateType.PATCH:
				if (!config.supportsPatch) {
					console.warn(`PowerSync: PATCH not supported for "${entry.table}", skipping`);
					return;
				}
				await putJson(`${config.basePath}/${entry.id}`, payload);
				break;

			case UpdateType.DELETE:
				if (!config.supportsDelete) {
					console.warn(`PowerSync: DELETE not supported for "${entry.table}", skipping`);
					return;
				}
				await deleteRequest(`${config.basePath}/${entry.id}`);
				break;

			default:
				console.warn(`PowerSync: unknown op "${entry.op}" for table "${entry.table}"`);
		}
	}
}
