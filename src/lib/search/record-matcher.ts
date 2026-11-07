/**
 * The shared search matcher (sprint 058-DR, design r1 SR-03 / O08). One query interpretation,
 * one matching rule and one rank scale for every search surface: `GET /api/search` (notes and
 * time entries), the `[[` wiki-link picker (`GET /api/notes/search`, notes only) and the picker's
 * offline fallback over the read cache (`$lib/offline/offline-reads.ts`).
 *
 * Pure: no database, no decryption, safe in the browser. Server callers decrypt their candidates
 * (the columns are encrypted at rest, so SQL `ILIKE` can never help) and hand plain fields in.
 * A note's body may be passed as a function: it is only read (and decrypted) when some word is
 * not already in the note's ID or title.
 *
 * Query: trimmed, NFC-normalised, lower-cased and split on whitespace into words. Every word must
 * be found (case-insensitive substring) in at least one searchable field of the record: AND across
 * words, OR across fields. There is no filter syntax and no implicit scope.
 */

export type SearchQuery = {
	/** The whole normalised query ('' when empty); ID ranks compare against it */
	phrase: string;
	/** Distinct lower-cased words, in query order */
	terms: string[];
};

/** Lower ranks sort first; one scale for notes and time entries, so the two can be merged. */
export const SEARCH_RANK = {
	/** The whole query is the note ID */
	ID_EXACT: 0,
	/** The note ID starts with the whole query */
	ID_PREFIX: 1,
	/** Every word is in the note's title (stored title, else first line) */
	TITLE: 2,
	/** The note ID contains the whole query */
	ID_CONTAINS: 3,
	/**
	 * Some words only in the client/contract (entry: also deliverable/work type), the rest in the
	 * record's own text. Above CONTENT: naming the client is a deliberate signal (058-DR review).
	 */
	CONTENT_AND_CONTEXT: 4,
	/** Every word is in the record's own text: note ID, title or body; an entry's description */
	CONTENT: 5,
	/** No word in the record's own text: matched on client/contract identity alone */
	CONTEXT_ONLY: 6
} as const;

export type SearchRank = (typeof SEARCH_RANK)[keyof typeof SEARCH_RANK];

/** Identity fields a record can match on without its own text mentioning them */
export type ContextField = 'clientName' | 'clientShortCode' | 'contractName' | 'deliverableName' | 'workTypeName';

export type RecordContext = {
	clientName: string;
	clientShortCode: string;
	contractName: string;
};

export type NoteMatchFields = RecordContext & {
	id: string;
	/** Display title (stored title, else first line), or null */
	title: string | null;
	/** Markdown body, or a function returning it, called at most once and only when needed */
	body: string | null | (() => string | null);
};

export type TimeEntryMatchFields = RecordContext & {
	description: string | null;
	deliverableName: string | null;
	workTypeName: string | null;
};

export type RecordMatch = {
	rank: SearchRank;
	/** The strongest field that matched; 'context' when only identity fields did */
	matchedIn: 'id' | 'title' | 'body' | 'description' | 'context';
	/** Identity fields that were needed for a word no content field held (the match's reason) */
	matchedContext: ContextField[];
};

/** Parse a raw query string. An empty or blank query has no terms. */
export function parseSearchQuery(rawQuery: string): SearchQuery {
	const phrase = rawQuery.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
	const terms = phrase ? [...new Set(phrase.split(' '))] : [];
	return { phrase, terms };
}

/** The needles to highlight: the phrase (so adjacent words highlight as one run) and each word. */
export function highlightNeedles(query: SearchQuery): string[] {
	return query.terms.length > 1 ? [query.phrase, ...query.terms] : query.terms;
}

type LowerContext = Array<[ContextField, string]>;

function lowerContext(fields: Array<[ContextField, string | null]>): LowerContext {
	return fields.map(([name, value]) => [name, (value ?? '').toLowerCase()]);
}

function contextOf(fields: RecordContext): Array<[ContextField, string | null]> {
	return [
		['clientName', fields.clientName],
		['clientShortCode', fields.clientShortCode],
		['contractName', fields.contractName]
	];
}

/** Context fields (in field order) that hold `term`, or null when none does */
function contextHits(context: LowerContext, term: string): ContextField[] | null {
	const hits = context.filter(([, value]) => value.includes(term)).map(([name]) => name);
	return hits.length > 0 ? hits : null;
}

function inFieldOrder(context: LowerContext, matched: Set<ContextField>): ContextField[] {
	return context.map(([name]) => name).filter((name) => matched.has(name));
}

function contentRank(matchedContext: ContextField[]): SearchRank {
	return matchedContext.length === 0 ? SEARCH_RANK.CONTENT : SEARCH_RANK.CONTENT_AND_CONTEXT;
}

/** Rank a note against a parsed query, or null when some word matches nothing. */
export function matchNote(query: SearchQuery, fields: NoteMatchFields): RecordMatch | null {
	if (query.terms.length === 0) return null;
	const lowerId = fields.id.toLowerCase();
	const lowerTitle = (fields.title ?? '').toLowerCase();
	const none: ContextField[] = [];
	if (lowerId === query.phrase) return { rank: SEARCH_RANK.ID_EXACT, matchedIn: 'id', matchedContext: none };
	if (lowerId.startsWith(query.phrase)) return { rank: SEARCH_RANK.ID_PREFIX, matchedIn: 'id', matchedContext: none };
	if (query.terms.every((term) => lowerTitle.includes(term))) {
		return { rank: SEARCH_RANK.TITLE, matchedIn: 'title', matchedContext: none };
	}
	if (lowerId.includes(query.phrase)) return { rank: SEARCH_RANK.ID_CONTAINS, matchedIn: 'id', matchedContext: none };

	let lowerBody: string | undefined;
	const readLowerBody = () => {
		lowerBody ??= ((typeof fields.body === 'function' ? fields.body() : fields.body) ?? '').toLowerCase();
		return lowerBody;
	};
	const context = lowerContext(contextOf(fields));
	const matched = new Set<ContextField>();
	let contentTermCount = 0;
	let inTitle = false;
	let inBody = false;
	for (const term of query.terms) {
		const titleHas = lowerTitle.includes(term);
		inTitle ||= titleHas;
		if (titleHas || lowerId.includes(term)) {
			contentTermCount += 1;
		} else if (readLowerBody().includes(term)) {
			contentTermCount += 1;
			inBody = true;
		} else {
			const hits = contextHits(context, term);
			if (!hits) return null;
			for (const name of hits) matched.add(name);
		}
	}
	const matchedContext = inFieldOrder(context, matched);
	if (contentTermCount === 0) return { rank: SEARCH_RANK.CONTEXT_ONLY, matchedIn: 'context', matchedContext };
	return { rank: contentRank(matchedContext), matchedIn: inBody ? 'body' : inTitle ? 'title' : 'id', matchedContext };
}

/** Rank a time entry against a parsed query, or null when some word matches nothing. */
export function matchTimeEntry(query: SearchQuery, fields: TimeEntryMatchFields): RecordMatch | null {
	if (query.terms.length === 0) return null;
	const lowerDescription = (fields.description ?? '').toLowerCase();
	const context = lowerContext([
		...contextOf(fields),
		['deliverableName', fields.deliverableName],
		['workTypeName', fields.workTypeName]
	]);
	const matched = new Set<ContextField>();
	let contentTermCount = 0;
	for (const term of query.terms) {
		if (lowerDescription.includes(term)) {
			contentTermCount += 1;
			continue;
		}
		const hits = contextHits(context, term);
		if (!hits) return null;
		for (const name of hits) matched.add(name);
	}
	const matchedContext = inFieldOrder(context, matched);
	if (contentTermCount === 0) return { rank: SEARCH_RANK.CONTEXT_ONLY, matchedIn: 'context', matchedContext };
	return { rank: contentRank(matchedContext), matchedIn: 'description', matchedContext };
}

export type Ranked<Candidate> = { candidate: Candidate; match: RecordMatch };

/** Rank, then larger (newer) recency key, then ID ascending: a total order. */
export function compareRanked(
	left: { rank: number; recency: string; id: string },
	right: { rank: number; recency: string; id: string }
): number {
	return (
		left.rank - right.rank ||
		(left.recency < right.recency ? 1 : left.recency > right.recency ? -1 : 0) ||
		(left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
	);
}

/**
 * Match every candidate and sort: rank first, then most recent (`recencyKey` compares as text,
 * larger is newer, e.g. an ISO timestamp), then `idOf` ascending so the order is total.
 */
export function rankCandidates<Candidate>(
	candidates: Candidate[],
	matchOne: (candidate: Candidate) => RecordMatch | null,
	recencyKey: (candidate: Candidate) => string,
	idOf: (candidate: Candidate) => string
): Ranked<Candidate>[] {
	const ranked: Array<Ranked<Candidate> & { rank: number; recency: string; id: string }> = [];
	for (const candidate of candidates) {
		const match = matchOne(candidate);
		if (match) ranked.push({ candidate, match, rank: match.rank, recency: recencyKey(candidate), id: idOf(candidate) });
	}
	ranked.sort(compareRanked);
	return ranked.map(({ candidate, match }) => ({ candidate, match }));
}

/** Sort an already-matched list (e.g. recent notes, rank null) newest first, then by ID. */
export function sortByRecency<Candidate>(
	candidates: Candidate[],
	recencyKey: (candidate: Candidate) => string,
	idOf: (candidate: Candidate) => string
): Candidate[] {
	return candidates
		.map((candidate) => ({ candidate, rank: 0, recency: recencyKey(candidate), id: idOf(candidate) }))
		.sort(compareRanked)
		.map(({ candidate }) => candidate);
}
