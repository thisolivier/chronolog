/**
 * The shared search matcher (sprint 058-DR, design r1 SR-03 / O08). One query interpretation,
 * one matching rule and one rank scale for every search surface: `GET /api/search` (notes and
 * time entries) and the `[[` wiki-link picker (`GET /api/notes/search`, notes only).
 *
 * Pure: no database, no decryption. Callers decrypt their candidates (the columns are encrypted
 * at rest, so SQL `ILIKE` can never help) and hand plain fields in.
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
	/** Every word is in the record's own text: note ID, title or body; an entry's description */
	CONTENT: 4,
	/** Some words only in the client/contract (entry: also deliverable/work type), the rest in content */
	CONTENT_AND_CONTEXT: 5,
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
	/** Markdown body */
	body: string | null;
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

function contains(value: string | null | undefined, lowerTerm: string): boolean {
	return !!value && value.toLowerCase().includes(lowerTerm);
}

/**
 * Split the words over content and context. Returns null if some word is in neither, else the
 * context fields that words missing from content needed, and how many words content held.
 */
function coverTerms(
	terms: string[],
	contentFields: Array<string | null>,
	contextFields: Array<[ContextField, string | null]>
): { contentTermCount: number; matchedContext: ContextField[] } | null {
	let contentTermCount = 0;
	const matchedContext = new Set<ContextField>();
	for (const term of terms) {
		if (contentFields.some((field) => contains(field, term))) {
			contentTermCount += 1;
			continue;
		}
		const contextHits = contextFields.filter(([, value]) => contains(value, term));
		if (contextHits.length === 0) return null;
		for (const [name] of contextHits) matchedContext.add(name);
	}
	const order = contextFields.map(([name]) => name);
	return { contentTermCount, matchedContext: order.filter((name) => matchedContext.has(name)) };
}

function contextOf(fields: RecordContext): Array<[ContextField, string | null]> {
	return [
		['clientName', fields.clientName],
		['clientShortCode', fields.clientShortCode],
		['contractName', fields.contractName]
	];
}

/** Rank a note against a parsed query, or null when some word matches nothing. */
export function matchNote(query: SearchQuery, fields: NoteMatchFields): RecordMatch | null {
	if (query.terms.length === 0) return null;
	const lowerId = fields.id.toLowerCase();
	const none: ContextField[] = [];
	if (lowerId === query.phrase) return { rank: SEARCH_RANK.ID_EXACT, matchedIn: 'id', matchedContext: none };
	if (lowerId.startsWith(query.phrase)) return { rank: SEARCH_RANK.ID_PREFIX, matchedIn: 'id', matchedContext: none };
	if (query.terms.every((term) => contains(fields.title, term))) {
		return { rank: SEARCH_RANK.TITLE, matchedIn: 'title', matchedContext: none };
	}
	if (lowerId.includes(query.phrase)) return { rank: SEARCH_RANK.ID_CONTAINS, matchedIn: 'id', matchedContext: none };

	const cover = coverTerms(query.terms, [fields.id, fields.title, fields.body], contextOf(fields));
	if (!cover) return null;
	if (cover.contentTermCount === 0) {
		return { rank: SEARCH_RANK.CONTEXT_ONLY, matchedIn: 'context', matchedContext: cover.matchedContext };
	}
	const inBody = query.terms.some((term) => contains(fields.body, term) && !contains(fields.title, term));
	const inTitle = query.terms.some((term) => contains(fields.title, term));
	const matchedIn = inBody ? 'body' : inTitle ? 'title' : 'id';
	const rank = cover.matchedContext.length === 0 ? SEARCH_RANK.CONTENT : SEARCH_RANK.CONTENT_AND_CONTEXT;
	return { rank, matchedIn, matchedContext: cover.matchedContext };
}

/** Rank a time entry against a parsed query, or null when some word matches nothing. */
export function matchTimeEntry(query: SearchQuery, fields: TimeEntryMatchFields): RecordMatch | null {
	if (query.terms.length === 0) return null;
	const context: Array<[ContextField, string | null]> = [
		...contextOf(fields),
		['deliverableName', fields.deliverableName],
		['workTypeName', fields.workTypeName]
	];
	const cover = coverTerms(query.terms, [fields.description], context);
	if (!cover) return null;
	if (cover.contentTermCount === 0) {
		return { rank: SEARCH_RANK.CONTEXT_ONLY, matchedIn: 'context', matchedContext: cover.matchedContext };
	}
	const rank = cover.matchedContext.length === 0 ? SEARCH_RANK.CONTENT : SEARCH_RANK.CONTENT_AND_CONTEXT;
	return { rank, matchedIn: 'description', matchedContext: cover.matchedContext };
}

export type Ranked<Candidate> = { candidate: Candidate; match: RecordMatch };

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
	const ranked: Array<Ranked<Candidate> & { recency: string; id: string }> = [];
	for (const candidate of candidates) {
		const match = matchOne(candidate);
		if (match) ranked.push({ candidate, match, recency: recencyKey(candidate), id: idOf(candidate) });
	}
	ranked.sort(
		(left, right) =>
			left.match.rank - right.match.rank ||
			(left.recency < right.recency ? 1 : left.recency > right.recency ? -1 : 0) ||
			(left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
	);
	return ranked.map(({ candidate, match }) => ({ candidate, match }));
}
