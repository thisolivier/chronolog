/**
 * Requests the offline outbox deliberately does not queue (sprint 056-DR): splitting and resuming
 * the timer change the one live draft in place, so a replay hours later could not be trusted.
 * Offline they fail at once with a clear message instead of a network error.
 */
import { connectivity } from '$lib/stores/connectivity.svelte';
import { isOfflineError } from './replay-transport';

export class NotAvailableOfflineError extends Error {
	constructor(action: string) {
		super(`${action} is not available offline. Reconnect and try again.`);
		this.name = 'NotAvailableOfflineError';
	}
}

/** Runs `request` online; offline (or when it fails to reach the server) throws `NotAvailableOfflineError`. */
export async function runOnlineOnly<Result>(action: string, request: () => Promise<Result>): Promise<Result> {
	if (connectivity.isOffline) throw new NotAvailableOfflineError(action);
	try {
		return await request();
	} catch (error) {
		if (isOfflineError(error)) throw new NotAvailableOfflineError(action);
		throw error;
	}
}
