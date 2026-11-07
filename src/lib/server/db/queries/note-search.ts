import { eq, and, inArray, isNull } from 'drizzle-orm';
import { database, notes, contracts, clients } from '$lib/server/db';
import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { decryptNullable } from '$lib/server/crypto/server-cipher';
import type { MatchRange, SearchSnippet } from '$lib/utils/search-snippet';
import {
	matchNote,
	parseSearchQuery,
	rankCandidates,
	sortByRecency,
	type ContextField,
	type RecordMatch,
	type SearchQuery
} from '$lib/server/search/record-matcher';
import {
	hitContextOf,
	loadNoteCandidates,
	noteRecencyKey,
	type HitContext,
	type NoteCandidate
} from '$lib/server/search/search-candidates';
import { noteExcerpt } from '$lib/server/search/search-excerpts';
import { wikiLinkPreviewOptions } from './wiki-link-titles';

/**
 * Note search for the `[[` picker (`GET /api/notes/search`) and title lookup.
 *
 * Matching and ranking are the shared matcher in `$lib/server/search/` (sprint 058-DR), the same
 * one `GET /api/search` uses, so a query orders notes identically on both surfaces.
 * `notes.title`, `notes.content`, `notes.content_json` and the contract/client names are encrypted
 * at rest, so every match is done in memory after decrypting the user's notes. Never filter these
 * columns with SQL `ILIKE`: it would only ever see ciphertext.
 */

export type NoteSearchResult = HitContext & {
	id: string;
	title: string | null;
	/** Stored title, else first content line, else null (callers fall back to the ID) */
	displayTitle: string | null;
	firstLine: string;
	secondLine: string;
	updatedAt: Date;
	/** Shared rank (`SEARCH_RANK`), null for the recent-notes list of an empty query */
	rank: number | null;
	/** Where the note matched; null for the recent-notes list */
	matchedIn: RecordMatch['matchedIn'] | null;
	/** Client/contract fields that matched words the note's own text lacks */
	matchedContext: ContextField[];
	/** Match offsets inside `displayTitle ?? id` */
	titleMatches: MatchRange[];
	/**
	 * Body excerpt around the first body match (the unhighlighted start of the body otherwise);
	 * empty on the recent list, which never decrypts bodies (use firstLine/secondLine there)
	 */
	snippet: SearchSnippet;
};

export type NoteSearchOptions = {
	limit?: number;
	/** The note being edited; never offered as its own link target */
	excludeNoteId?: string;
};

export const DEFAULT_NOTE_SEARCH_LIMIT = 8;

/** The recent list (empty query) never reads the body: no excerpt, no highlights */
const NO_EXCERPT = { titleMatches: [], snippet: { text: '', matches: [] } };

function toSearchResult(note: NoteCandidate, query: SearchQuery, match: RecordMatch | null): NoteSearchResult {
	const preview = extractPreviewLines(note.contentJson);
	const excerpt = match ? noteExcerpt(note, query) : NO_EXCERPT;
	return {
		id: note.id,
		title: note.title,
		displayTitle: note.displayTitle,
		...hitContextOf(note),
		firstLine: preview.firstLine,
		secondLine: preview.secondLine,
		updatedAt: note.updatedAt,
		rank: match?.rank ?? null,
		matchedIn: match?.matchedIn ?? null,
		matchedContext: match?.matchedContext ?? [],
		titleMatches: excerpt.titleMatches,
		snippet: excerpt.snippet
	};
}

/**
 * Search all of a user's notes with the shared matcher (every query word in the note's ID, title,
 * body, client name, client short code or contract name). Ranked: exact ID, ID prefix, title,
 * ID substring, content plus client/contract, body, client/contract only; newest first within a
 * rank. Never scoped to a client or contract. An empty query returns the most recently edited
 * notes (across every contract).
 */
export async function searchNotesForUser(
	userId: string,
	rawQuery: string,
	limitOrOptions: number | NoteSearchOptions = {}
): Promise<NoteSearchResult[]> {
	const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
	const limit = options.limit ?? DEFAULT_NOTE_SEARCH_LIMIT;
	const query = parseSearchQuery(rawQuery);
	const candidates = (await loadNoteCandidates(userId)).filter((note) => note.id !== options.excludeNoteId);

	if (query.terms.length === 0) {
		return sortByRecency(candidates, noteRecencyKey, (note) => note.id)
			.slice(0, limit)
			.map((note) => toSearchResult(note, query, null));
	}
	return rankCandidates(
		candidates,
		(note) => matchNote(query, { ...note, title: note.displayTitle, body: note.readContent }),
		noteRecencyKey,
		(note) => note.id
	)
		.slice(0, limit)
		.map(({ candidate, match }) => toSearchResult(candidate, query, match));
}

/**
 * Display titles (plus contract and client IDs, for cross-contract navigation) for a set
 * of note IDs owned by the user. Unknown or foreign IDs are simply absent from the result, and so
 * are trashed notes unless `includeDeleted`, which returns them with their `deletedAt` (the
 * wiki-link renderer shows those as "deleted" links that offer a restore, sprint 037-CL).
 */
export async function getNoteTitlesForUser(
	userId: string,
	noteIds: string[],
	options: { includeDeleted?: boolean } = {}
) {
	if (noteIds.length === 0) return [];
	const owned = and(eq(notes.userId, userId), inArray(notes.id, noteIds));
	const rows = await database
		.select({
			id: notes.id,
			title: notes.title,
			content: notes.content,
			contentJson: notes.contentJson,
			contractId: notes.contractId,
			deletedAt: notes.deletedAt,
			clientId: clients.id
		})
		.from(notes)
		.innerJoin(contracts, eq(notes.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(
		options.includeDeleted ? owned : and(owned, isNull(notes.deletedAt))
	);
	const decrypted = rows.map((row) => ({
		row,
		title: decryptNullable(row.title, 'notes.title'),
		content: decryptNullable(row.content, 'notes.content'),
		contentJson: decryptNullable(row.contentJson, 'notes.content_json')
	}));
	const previewOptions = await wikiLinkPreviewOptions(userId, decrypted);
	return decrypted.map(({ row, title, content, contentJson }) => {
		return {
			id: row.id,
			// A note created over the API (no JSON yet) is named by its markdown's first line (043)
			displayTitle:
				noteDisplayTitle(title, contentJson, previewOptions) ??
				(contentJson ? null : extractMarkdownPreviewLines(content, previewOptions).firstLine || null),
			contractId: row.contractId,
			clientId: row.clientId,
			...(options.includeDeleted ? { deletedAt: row.deletedAt } : {})
		};
	});
}
