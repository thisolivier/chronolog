/**
 * Short-lived per-deliverable cache of "does this deliverable have work types?", so each entry
 * row can decide on its "Add work type" cue without one request per row (the deliverable
 * counterpart lives in timer/deliverable-cache.ts). Entries expire after a minute.
 */
import type { DataService } from '$lib/services/data-service';

const CACHE_LIFETIME_MILLISECONDS = 60_000;

const cachedLookups = new Map<string, { expiresAt: number; lookup: Promise<boolean> }>();

export function deliverableHasWorkTypes(dataService: DataService, deliverableId: string): Promise<boolean> {
	const now = Date.now();
	const cached = cachedLookups.get(deliverableId);
	if (cached && cached.expiresAt > now) return cached.lookup;
	const lookup = dataService
		.getWorkTypes(deliverableId)
		.then((workTypeList) => workTypeList.length > 0)
		.catch(() => false);
	cachedLookups.set(deliverableId, { expiresAt: now + CACHE_LIFETIME_MILLISECONDS, lookup });
	return lookup;
}
