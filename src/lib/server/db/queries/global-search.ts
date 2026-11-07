import type { MatchRange, SearchSnippet } from '$lib/utils/search-snippet';
import {
	matchNote,
	matchTimeEntry,
	parseSearchQuery,
	rankCandidates,
	type ContextField,
	type RecordMatch,
	type SearchQuery
} from '$lib/server/search/record-matcher';
import {
	loadNoteCandidates,
	loadTimeEntryCandidates,
	noteRecencyKey,
	timeEntryRecencyKey,
	hitContextOf,
	type HitContext
} from '$lib/server/search/search-candidates';
import { noteExcerpt, timeEntryExcerpt } from '$lib/server/search/search-excerpts';

/**
 * Global search (sprint 042-CL; shared matcher since 058-DR): the user's notes and time entries
 * across every client, for `GET /api/search` and `chronolog search`.
 *
 * Matching and ranking live in `$lib/server/search/` and are shared with the `[[` picker
 * (`note-search.ts`). Each group comes back in rank order (rank, then newest), and each hit
 * carries its `rank` so a client can merge the two groups on the same scale. Trashed notes are
 * never returned.
 */

export type { HitContext };

export type NoteSearchHit = HitContext & {
	id: string;
	title: string;
	/** Where the note matched: its ID, its title (or first line), its body, or only its client/contract */
	matchedIn: 'id' | 'title' | 'body' | 'context';
	/** Shared rank (`SEARCH_RANK`, lower is better) */
	rank: number;
	/** Client/contract fields that matched words the note's own text lacks */
	matchedContext: ContextField[];
	/** Match offsets inside `title` */
	titleMatches: MatchRange[];
	/** Excerpt of the body around the first body match (the unhighlighted start of the body otherwise) */
	snippet: SearchSnippet;
	updatedAt: Date;
};

export type TimeEntrySearchHit = HitContext & {
	id: string;
	/** YYYY-MM-DD */
	date: string;
	startTime: string | null;
	durationMinutes: number;
	deliverableName: string | null;
	workTypeName: string | null;
	/** 'description', or 'context' when only client/contract/deliverable/work type matched */
	matchedIn: 'description' | 'context';
	rank: number;
	matchedContext: ContextField[];
	snippet: SearchSnippet;
};

export type GlobalSearchResult = {
	query: string;
	notes: { hits: NoteSearchHit[]; total: number };
	timeEntries: { hits: TimeEntrySearchHit[]; total: number };
};

export const MINIMUM_QUERY_LENGTH = 2;

function matchFields(match: RecordMatch) {
	return { rank: match.rank, matchedContext: match.matchedContext };
}

async function searchNotes(userId: string, query: SearchQuery, limit: number) {
	const ranked = rankCandidates(
		await loadNoteCandidates(userId),
		(note) => matchNote(query, { ...note, title: note.displayTitle, body: note.content }),
		noteRecencyKey,
		(note) => note.id
	);
	const hits = ranked.slice(0, limit).map(({ candidate: note, match }): NoteSearchHit => {
		return {
			id: note.id,
			...noteExcerpt(note, query),
			updatedAt: note.updatedAt,
			...hitContextOf(note),
			matchedIn: match.matchedIn as NoteSearchHit['matchedIn'],
			...matchFields(match)
		};
	});
	return { hits, total: ranked.length };
}

async function searchTimeEntries(userId: string, query: SearchQuery, limit: number) {
	const ranked = rankCandidates(
		await loadTimeEntryCandidates(userId),
		(entry) => matchTimeEntry(query, entry),
		timeEntryRecencyKey,
		(entry) => entry.id
	);
	const hits = ranked.slice(0, limit).map(({ candidate: entry, match }): TimeEntrySearchHit => {
		return {
			id: entry.id,
			date: entry.date,
			startTime: entry.startTime,
			durationMinutes: entry.durationMinutes,
			deliverableName: entry.deliverableName,
			workTypeName: entry.workTypeName,
			...hitContextOf(entry),
			snippet: timeEntryExcerpt(entry, query),
			matchedIn: match.matchedIn as TimeEntrySearchHit['matchedIn'],
			...matchFields(match)
		};
	});
	return { hits, total: ranked.length };
}

/**
 * Search a user's notes and time entries with the shared matcher: every word of the query must
 * match the record's own text or its client/contract identity. `limit` applies per group and
 * `total` counts every match. A query shorter than two characters returns nothing.
 */
export async function searchEverythingForUser(userId: string, rawQuery: string, limit = 20): Promise<GlobalSearchResult> {
	const trimmedQuery = rawQuery.trim();
	const query = parseSearchQuery(trimmedQuery);
	if (query.phrase.length < MINIMUM_QUERY_LENGTH) {
		return { query: trimmedQuery, notes: { hits: [], total: 0 }, timeEntries: { hits: [], total: 0 } };
	}
	const [noteResults, entryResults] = await Promise.all([
		searchNotes(userId, query, limit),
		searchTimeEntries(userId, query, limit)
	]);
	return { query: trimmedQuery, notes: noteResults, timeEntries: entryResults };
}
