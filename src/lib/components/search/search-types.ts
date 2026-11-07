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
