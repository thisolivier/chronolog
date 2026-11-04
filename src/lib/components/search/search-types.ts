/** Client-side shapes of `GET /api/search` (sprint 042-CL); dates arrive as strings. */
import type { NoteSearchHit, TimeEntrySearchHit } from '$lib/server/db/queries/global-search';

export type NoteHit = Omit<NoteSearchHit, 'updatedAt'> & { updatedAt: string };
export type TimeEntryHit = TimeEntrySearchHit;

export type GlobalSearchResponse = {
	query: string;
	minimumQueryLength: number;
	notes: { hits: NoteHit[]; total: number };
	timeEntries: { hits: TimeEntryHit[]; total: number };
};

export async function fetchGlobalSearch(query: string, signal?: AbortSignal): Promise<GlobalSearchResponse> {
	const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=50`, { signal });
	if (!response.ok) throw new Error(`Search failed (${response.status})`);
	return response.json();
}

/**
 * Client colour indexes by client id (sprint 046-CL), for the colour dot on each hit. Read from
 * `GET /api/clients` so the search response keeps its shape; an empty map (grey dots) on failure.
 */
export async function fetchClientColorIndexes(signal?: AbortSignal): Promise<Map<string, number>> {
	try {
		const response = await fetch('/api/clients?includeArchived=true', {
			signal
		});
		if (!response.ok) return new Map();
		const body: { clients: { id: string; colorIndex: number }[] } = await response.json();
		return new Map(body.clients.map((client) => [client.id, client.colorIndex]));
	} catch {
		return new Map();
	}
}
