/**
 * PowerSync Backend Connector
 *
 * Implements the PowerSyncBackendConnector interface to:
 * 1. Fetch authentication credentials (JWT) from the app backend
 * 2. Upload local CRUD changes to the app's REST API endpoints
 *
 * PowerSync calls fetchCredentials() to get a token for its sync connection,
 * and calls uploadData() whenever there are local changes to push to the server.
 */

import type {
	PowerSyncBackendConnector,
	PowerSyncCredentials,
	AbstractPowerSyncDatabase
} from '@powersync/web';
import { fetchJson, postJson, putJson, deleteRequest } from '$lib/services/fetch-helpers';

/**
 * PowerSync service URL. Defaults to local Docker instance.
 * Override via VITE_POWERSYNC_URL environment variable.
 */
const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL ?? 'http://localhost:8080';

/** Maximum number of CRUD operations to process in a single batch. */
const CRUD_BATCH_SIZE = 100;

/** Response shape from the /api/auth/powersync/token endpoint. */
interface TokenResponse {
	token: string;
	expiresAt: string;
}

/**
 * Maps PowerSync CRUD operations to the app's existing REST API routes.
 *
 * For each table, defines which HTTP method and URL to use for
 * put (create), patch (update), and delete operations.
 */
const TABLE_API_CONFIG: Record<
	string,
	{
		basePath: string;
		supportsPatch?: boolean;
		supportsDelete?: boolean;
	}
> = {
	notes: {
		basePath: '/api/notes',
		supportsPatch: true,
		supportsDelete: true
	},
	time_entries: {
		basePath: '/api/time-entries',
		supportsPatch: true,
		supportsDelete: true
	},
	clients: {
		basePath: '/api/clients'
	},
	contracts: {
		basePath: '/api/contracts'
	}
};

export class ChronologConnector implements PowerSyncBackendConnector {
	/**
	 * Fetch a fresh JWT from the app backend for PowerSync authentication.
	 *
	 * Returns null if the user is not authenticated (fetch fails).
	 * Throws on network errors so PowerSync can retry.
	 */
	async fetchCredentials(): Promise<PowerSyncCredentials | null> {
		try {
			const tokenResponse = await fetchJson<TokenResponse>(
				'/api/auth/powersync/token'
			);

			return {
				endpoint: POWERSYNC_URL,
				token: tokenResponse.token,
				expiresAt: new Date(tokenResponse.expiresAt)
			};
		} catch (fetchError) {
			console.warn('PowerSync fetchCredentials failed — user may not be authenticated:', fetchError);
			return null;
		}
	}

	/**
	 * Upload local CRUD changes to the app backend via REST API.
	 *
	 * Gets a batch of pending changes from the PowerSync database,
	 * maps each operation to the appropriate API endpoint, and
	 * marks the batch as complete once all operations succeed.
	 *
	 * If any operation fails, the error is thrown so PowerSync
	 * retries the entire batch after its configured wait period (default 5s).
	 */
	async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
		const crudBatch = await database.getCrudBatch(CRUD_BATCH_SIZE);

		if (!crudBatch) {
			return;
		}

		for (const crudEntry of crudBatch.crud) {
			const tableConfig = TABLE_API_CONFIG[crudEntry.table];

			if (!tableConfig) {
				console.warn(
					`PowerSync uploadData: unhandled table "${crudEntry.table}" — ` +
					`skipping ${crudEntry.op} operation for id "${crudEntry.id}"`
				);
				continue;
			}

			await this.processCrudEntry(crudEntry, tableConfig);
		}

		await crudBatch.complete();
	}

	/**
	 * Process a single CRUD entry by dispatching to the correct HTTP method.
	 */
	private async processCrudEntry(
		crudEntry: { op: string; id: string; table: string; opData?: Record<string, unknown> },
		tableConfig: { basePath: string; supportsPatch?: boolean; supportsDelete?: boolean }
	): Promise<void> {
		const entityUrl = `${tableConfig.basePath}/${crudEntry.id}`;

		switch (crudEntry.op) {
			case 'PUT': {
				const createPayload = { id: crudEntry.id, ...crudEntry.opData };
				await postJson(tableConfig.basePath, createPayload);
				break;
			}

			case 'PATCH': {
				if (!tableConfig.supportsPatch) {
					console.warn(
						`PowerSync uploadData: PATCH not supported for table "${crudEntry.table}" — ` +
						`skipping update for id "${crudEntry.id}"`
					);
					break;
				}
				const updatePayload = { ...crudEntry.opData };
				await putJson(entityUrl, updatePayload);
				break;
			}

			case 'DELETE': {
				if (!tableConfig.supportsDelete) {
					console.warn(
						`PowerSync uploadData: DELETE not supported for table "${crudEntry.table}" — ` +
						`skipping delete for id "${crudEntry.id}"`
					);
					break;
				}
				await deleteRequest(entityUrl);
				break;
			}

			default:
				console.warn(
					`PowerSync uploadData: unknown operation "${crudEntry.op}" ` +
					`for table "${crudEntry.table}", id "${crudEntry.id}"`
				);
		}
	}
}
