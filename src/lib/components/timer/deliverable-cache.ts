/**
 * Short-lived per-contract cache of "does this contract have deliverables?", so each
 * time-entry card can decide whether to show its "Add deliverable…" prompt without
 * one request per card. Entries expire after a minute so admin changes show up.
 */
import type { DataService } from '$lib/services/data-service';

const CACHE_LIFETIME_MILLISECONDS = 60_000;

const cachedLookups = new Map<string, { expiresAt: number; lookup: Promise<boolean> }>();

export function contractHasDeliverables(dataService: DataService, contractId: string): Promise<boolean> {
	const now = Date.now();
	const cached = cachedLookups.get(contractId);
	if (cached && cached.expiresAt > now) return cached.lookup;

	const lookup = dataService
		.getDeliverables(contractId)
		.then((deliverableList) => deliverableList.length > 0)
		.catch(() => false);
	cachedLookups.set(contractId, { expiresAt: now + CACHE_LIFETIME_MILLISECONDS, lookup });
	return lookup;
}
