/**
 * Wiki-link targets for the `[[` picker (059-DR, SR-04): notes only (time entries have UUIDs and no
 * wiki-link parser or link table as targets). Read from `GET /api/notes/search` (the shared matcher
 * of 058-DR; an empty query with `recent=1` lists the most recently edited notes of every
 * contract). No scope, contract or timer filter is ever sent.
 */
export type LinkPickerItem = {
	noteId: string;
	/** The readable title (stored title, else first line, else the ID) */
	title: string;
	clientName: string;
	clientShortCode: string;
	clientColorIndex: number;
	contractName: string;
	/** ISO moment of the last edit */
	updatedAt: string;
};

/** The fields of a `/api/notes/search` result the picker reads (the response shape is unchanged) */
type NoteSearchResultJson = {
	id: string;
	displayTitle?: string | null;
	title?: string | null;
	clientName?: string;
	clientShortCode?: string;
	clientColorIndex?: number;
	contractName?: string;
	updatedAt?: string;
};

export const LINK_PICKER_LIMIT = 8;

export function toLinkPickerItem(note: NoteSearchResultJson): LinkPickerItem {
	return {
		noteId: note.id,
		title: note.displayTitle || note.title || note.id,
		clientName: note.clientName ?? '',
		clientShortCode: note.clientShortCode ?? '',
		clientColorIndex: note.clientColorIndex ?? 0,
		contractName: note.contractName ?? '',
		updatedAt: note.updatedAt ?? ''
	};
}

export type LinkTargetRequest = { exclude?: string | null; limit?: number; signal?: AbortSignal };

/** Notes for a query (recent notes for an empty one); throws on a failed request so it shows as one */
export async function fetchLinkTargets(query: string, request: LinkTargetRequest = {}): Promise<LinkPickerItem[]> {
	const parameters = new URLSearchParams({ q: query, recent: '1', limit: String(request.limit ?? LINK_PICKER_LIMIT) });
	if (request.exclude) parameters.set('exclude', request.exclude);
	const response = await fetch(`/api/notes/search?${parameters}`, { signal: request.signal });
	if (!response.ok) throw new Error(`Note search failed (${response.status})`);
	const body: { notes?: NoteSearchResultJson[] } = await response.json();
	return (body.notes ?? []).map(toLinkPickerItem);
}
