/**
 * Answers built from the read cache when the server cannot be asked (sprint 045-CL, and the
 * 024 follow-up): weeks assembled from any cached week request, note search and note titles over
 * the cached note lists and notes, and the names a time entry made offline shows with.
 * Pure functions over `[url, body]` pairs, newest first.
 */
import type {
	ContractOption,
	ContractsByClientResult,
	NoteDetail,
	NoteSearchOptions,
	NoteSearchResult,
	NoteSummary,
	NoteTitleInfo,
	TimeEntryDisplay,
	TimeEntryFields,
	WeekData
} from '$lib/services/types';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { matchNote, parseSearchQuery, rankCandidates, sortByRecency } from '$lib/search/record-matcher';

export type CachedRead = [url: string, body: unknown];

export type ContractInfo = Pick<
	TimeEntryDisplay,
	'contractName' | 'clientId' | 'clientName' | 'clientShortCode' | 'clientColorIndex'
>;

/** Contract and client names from the cached contract lists */
export function contractInfo(reads: CachedRead[], contractId: string): ContractInfo | null {
	for (const [url, body] of reads) {
		const contracts: (ContractOption | ContractsByClientResult)[] | undefined = url.startsWith('/api/contracts-by-client')
			? (body as { contracts?: ContractsByClientResult[] })?.contracts
			: url.startsWith('/api/contracts')
				? (body as ContractOption[])
				: undefined;
		const contract = Array.isArray(contracts) ? contracts.find((candidate) => candidate.id === contractId) : undefined;
		if (contract) {
			return {
				contractName: contract.name,
				clientId: contract.clientId,
				clientName: contract.clientName,
				clientShortCode: contract.clientShortCode,
				clientColorIndex: contract.clientColorIndex
			};
		}
	}
	return null;
}

/** A deliverable's or work type's name from the cached pickers' lists */
export function optionName(reads: CachedRead[], listPrefix: string, optionId: string | null | undefined): string | null {
	if (!optionId) return null;
	for (const [url, body] of reads) {
		if (!url.startsWith(listPrefix) || !Array.isArray(body)) continue;
		const option = (body as { id: string; name: string }[]).find((candidate) => candidate.id === optionId);
		if (option) return option.name;
	}
	return null;
}

/** Display fields for an entry's contract, deliverable and work type, as far as the cache knows */
export function entryDisplayNames(
	reads: CachedRead[],
	fields: Partial<Pick<TimeEntryFields, 'contractId' | 'deliverableId' | 'workTypeId'>>
): Partial<TimeEntryDisplay> {
	const names: Partial<TimeEntryDisplay> = {};
	if (fields.contractId) Object.assign(names, contractInfo(reads, fields.contractId) ?? {});
	if (fields.deliverableId !== undefined) names.deliverableName = optionName(reads, '/api/deliverables', fields.deliverableId);
	if (fields.workTypeId !== undefined) names.workTypeName = optionName(reads, '/api/work-types', fields.workTypeId);
	return names;
}

/** Every requested week from any cached week request, or null when one was never loaded */
export function weeksFromCache(weekStarts: string[], weeklyReads: CachedRead[]): WeekData[] | null {
	const weeks: WeekData[] = [];
	for (const weekStart of weekStarts) {
		const found = weeklyReads
			.flatMap(([, body]) => (body as { weeks?: WeekData[] })?.weeks ?? [])
			.find((week) => week.weekStart === weekStart);
		if (!found) return null;
		weeks.push(found);
	}
	return weeks;
}

/** The server copy of an entry as last loaded in any week */
export function cachedEntry(weeklyReads: CachedRead[], entryId: string): TimeEntryDisplay | null {
	for (const [, body] of weeklyReads) {
		for (const week of (body as { weeks?: WeekData[] })?.weeks ?? []) {
			for (const day of week.days) {
				const entry = day.entries.find((candidate) => candidate.id === entryId);
				if (entry) return entry;
			}
		}
	}
	return null;
}

type KnownNote = { summary: NoteSummary | null; detail: NoteDetail | null };

/** Notes the cache knows about: list rows and opened notes, newest copy first */
export function knownNotes(noteReads: CachedRead[]): Map<string, KnownNote> {
	const notes = new Map<string, KnownNote>();
	const known = (id: string) => notes.get(id) ?? notes.set(id, { summary: null, detail: null }).get(id)!;
	for (const [url, body] of noteReads) {
		const listed = (body as { notes?: NoteSummary[] })?.notes;
		const detail = (body as { note?: NoteDetail })?.note;
		if (Array.isArray(listed) && !url.startsWith('/api/notes/search')) {
			for (const summary of listed) known(summary.id).summary ??= summary;
		} else if (detail && typeof detail.id === 'string' && 'content' in detail) {
			known(detail.id).detail ??= detail;
		}
	}
	return notes;
}

function displayTitleOf(note: KnownNote): string | null {
	if (note.detail) return noteDisplayTitle(note.detail.title, note.detail.contentJson);
	return note.summary?.firstLine || null;
}

export function titlesFromCache(ids: string[], notes: Map<string, KnownNote>, reads: CachedRead[]): NoteTitleInfo[] {
	return ids.flatMap((id) => {
		const note = notes.get(id);
		const contractId = note?.detail?.contractId ?? note?.summary?.contractId;
		if (!note || !contractId) return [];
		return [{ id, displayTitle: displayTitleOf(note), contractId, clientId: contractInfo(reads, contractId)?.clientId ?? '' }];
	});
}

/**
 * Search what the cache holds (titles, previews, opened notes' text) with the same shared matcher
 * and rank order as the server (sprint 058-DR): every word in the note's ID, title, body (or cached
 * preview lines), client name, short code or contract name. An empty query with `recent` lists the
 * newest cached notes.
 */
export function searchCachedNotes(
	query: string,
	options: NoteSearchOptions,
	notes: Map<string, KnownNote>,
	reads: CachedRead[]
): NoteSearchResult[] {
	const parsed = parseSearchQuery(query);
	if (parsed.terms.length === 0 && !options.recent) return [];
	const candidates: NoteSearchResult[] = [];
	const bodies = new Map<string, string>();
	for (const [id, note] of notes) {
		if (id === options.excludeNoteId) continue;
		const contractId = note.detail?.contractId ?? note.summary?.contractId ?? '';
		const info = contractInfo(reads, contractId);
		bodies.set(id, note.detail?.content ?? [note.summary?.firstLine, note.summary?.secondLine].filter(Boolean).join('\n'));
		candidates.push({
			id,
			title: note.detail?.title ?? null,
			displayTitle: displayTitleOf(note),
			contractId,
			contractName: info?.contractName ?? '',
			clientId: info?.clientId ?? '',
			clientName: info?.clientName ?? '',
			clientShortCode: info?.clientShortCode ?? '',
			clientColorIndex: info?.clientColorIndex,
			firstLine: note.summary?.firstLine ?? '',
			secondLine: note.summary?.secondLine ?? '',
			updatedAt: note.detail?.updatedAt ?? note.summary?.updatedAt ?? '',
			rank: null,
			matchedIn: null,
			matchedContext: []
		});
	}
	const limit = options.limit ?? 25;
	const idOf = (result: NoteSearchResult) => result.id;
	const recencyOf = (result: NoteSearchResult) => result.updatedAt;
	if (parsed.terms.length === 0) return sortByRecency(candidates, recencyOf, idOf).slice(0, limit);
	return rankCandidates(
		candidates,
		(result) => matchNote(parsed, { ...result, title: result.displayTitle, body: bodies.get(result.id) ?? '' }),
		recencyOf,
		idOf
	)
		.slice(0, limit)
		.map(({ candidate, match }) => ({ ...candidate, ...match }));
}
