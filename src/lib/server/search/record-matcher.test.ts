/**
 * Sprint 058-DR: the shared search matcher. Pure tests (no database): query parsing, word AND
 * semantics, client/contract metadata, the rank table, tie-breaks, and the SR-03 examples.
 */
import { describe, expect, it } from 'vitest';
import {
	SEARCH_RANK,
	matchNote,
	matchTimeEntry,
	parseSearchQuery,
	rankCandidates,
	type NoteMatchFields,
	type TimeEntryMatchFields
} from './record-matcher';
import { noteExcerpt, timeEntryExcerpt } from './search-excerpts';
import type { NoteCandidate, TimeEntryCandidate } from './search-candidates';

const amplitude = { clientName: 'Amplitude', clientShortCode: 'AMPL', contractName: 'Analytics retainer' };
const hungryroot = { clientName: 'Hungryroot', clientShortCode: 'HROOT', contractName: 'Org design' };
const rankGroup = { clientName: 'Rank Group', clientShortCode: 'RANK', contractName: 'Platform' };

function noteFields(id: string, title: string | null, body: string | null, context = rankGroup): NoteMatchFields {
	return { id, title, body, ...context };
}

function entryFields(description: string, context = rankGroup, extra: Partial<TimeEntryMatchFields> = {}): TimeEntryMatchFields {
	return { description, deliverableName: null, workTypeName: null, ...context, ...extra };
}

function candidate(id: string, title: string | null, content: string, context = rankGroup, updatedAt = '2026-11-01T10:00:00Z'): NoteCandidate {
	return {
		id,
		title,
		contentJson: null,
		readContent: () => content,
		displayTitle: title,
		updatedAt: new Date(updatedAt),
		clientId: `client-${context.clientShortCode}`,
		clientColorIndex: 3,
		contractId: `contract-${context.clientShortCode}`,
		...context
	};
}

function rankNotes(query: string, notes: NoteCandidate[]): string[] {
	const parsed = parseSearchQuery(query);
	return rankCandidates(
		notes,
		(note) => matchNote(parsed, { ...note, title: note.displayTitle, body: note.readContent }),
		(note) => note.updatedAt.toISOString(),
		(note) => note.id
	).map(({ candidate: note }) => note.id);
}

describe('parseSearchQuery', () => {
	it('trims, lower-cases, NFC-normalises, collapses whitespace and drops repeated words', () => {
		expect(parseSearchQuery('  Hungryroot\t ROLES  roles ')).toEqual({ phrase: 'hungryroot roles roles', terms: ['hungryroot', 'roles'] });
		expect(parseSearchQuery('Café').terms).toEqual(['café']);
		expect(parseSearchQuery('   ')).toEqual({ phrase: '', terms: [] });
	});
});

describe('matchNote', () => {
	const kickoff = noteFields('ACME.20261103.002', 'Kickoff plan', '# Kickoff plan\n\nAgree the roles and the budget.');

	it('keeps the note rank order: exact ID, ID prefix, title, ID substring, body', () => {
		const rank = (query: string) => matchNote(parseSearchQuery(query), kickoff)?.rank;
		expect(rank('ACME.20261103.002')).toBe(SEARCH_RANK.ID_EXACT);
		expect(rank('acme.2026')).toBe(SEARCH_RANK.ID_PREFIX);
		expect(rank('kickoff')).toBe(SEARCH_RANK.TITLE);
		expect(rank('1103.002')).toBe(SEARCH_RANK.ID_CONTAINS);
		expect(rank('budget')).toBe(SEARCH_RANK.CONTENT);
	});

	it('needs every word somewhere (AND across words, OR across fields), in any order', () => {
		const query = (text: string) => matchNote(parseSearchQuery(text), kickoff);
		expect(query('plan kickoff')?.rank).toBe(SEARCH_RANK.TITLE);
		expect(query('kickoff budget')).toMatchObject({ rank: SEARCH_RANK.CONTENT, matchedIn: 'body' });
		expect(query('budget invoice')).toBeNull();
		expect(query('roles platform')).toMatchObject({ rank: SEARCH_RANK.CONTENT_AND_CONTEXT, matchedContext: ['contractName'] });
	});

	it('SR-03 "Amplitude": finds a note whose text never says Amplitude', () => {
		const match = matchNote(parseSearchQuery('Amplitude'), noteFields('AMPL.20261020.001', 'Event taxonomy', 'Funnels and cohorts.', amplitude));
		expect(match).toEqual({ rank: SEARCH_RANK.CONTEXT_ONLY, matchedIn: 'context', matchedContext: ['clientName'] });
	});

	it('SR-03 "Hungryroot roles": combines contract identity with roles content', () => {
		const query = parseSearchQuery('Hungryroot roles');
		expect(matchNote(query, noteFields('HROOT.1', 'Workshop', 'We mapped the roles.', hungryroot))).toEqual({
			rank: SEARCH_RANK.CONTENT_AND_CONTEXT,
			matchedIn: 'body',
			matchedContext: ['clientName']
		});
		// Hungryroot without roles, and roles outside Hungryroot, do not match
		expect(matchNote(query, noteFields('HROOT.2', 'Workshop', 'Budget only.', hungryroot))).toBeNull();
		expect(matchNote(query, noteFields('RANK.1', 'Roles', 'The roles.', rankGroup))).toBeNull();
	});

	it("SR-03 stable code: a note ID still finds that note, first", () => {
		const target = candidate('HROOT.20261104.0042', 'Roles', 'body', hungryroot, '2026-10-01T00:00:00Z');
		const mentioning = candidate('HROOT.20261105.0001', 'Follow-up', 'See [[HROOT.20261104.0042]]', hungryroot, '2026-11-05T00:00:00Z');
		expect(rankNotes('hroot.20261104.0042', [mentioning, target])).toEqual([target.id, mentioning.id]);
	});

	it('matches client name, short code and contract name; a short code usually hits the ID first', () => {
		// Real IDs are SHORTCODE.YYYYMMDD.SEQ, so a short-code query is an ID prefix of all that client's notes
		const note = noteFields('HROOT.20261104.0001', 'Notes', 'text', hungryroot);
		expect(matchNote(parseSearchQuery('hroot'), note)).toEqual({ rank: SEARCH_RANK.ID_PREFIX, matchedIn: 'id', matchedContext: [] });
		// A note moved to another client keeps its ID: then the short code matches as identity only
		const moved = noteFields('RANK.20261104.0001', 'Notes', 'text', hungryroot);
		expect(matchNote(parseSearchQuery('hroot'), moved)).toMatchObject({ rank: SEARCH_RANK.CONTEXT_ONLY, matchedContext: ['clientShortCode'] });
		expect(matchNote(parseSearchQuery('org design'), note)).toMatchObject({ rank: SEARCH_RANK.CONTEXT_ONLY, matchedContext: ['contractName'] });
		expect(matchNote(parseSearchQuery('hungryroot'), note)?.matchedContext).toEqual(['clientName']);
	});

	it('reads the body only when a word is not in the ID or title', () => {
		let bodyReads = 0;
		const note = { ...kickoff, body: () => (bodyReads++, 'Agree the roles and the budget.') };
		expect(matchNote(parseSearchQuery('kickoff'), note)?.rank).toBe(SEARCH_RANK.TITLE);
		expect(matchNote(parseSearchQuery('acme plan'), note)?.rank).toBe(SEARCH_RANK.CONTENT);
		expect(bodyReads).toBe(0);
		expect(matchNote(parseSearchQuery('budget roles'), note)?.rank).toBe(SEARCH_RANK.CONTENT);
		expect(bodyReads).toBe(1);
	});

	it('ranks identity plus content above content alone (Hungryroot roles)', () => {
		const query = 'hungryroot roles';
		const own = candidate('HROOT.20261101.0001', 'Workshop', 'The roles.', hungryroot, '2026-11-01T00:00:00Z');
		const mention = candidate('RANK.20261105.0001', 'Notes', 'Hungryroot asked about roles.', rankGroup, '2026-11-05T00:00:00Z');
		expect(rankNotes(query, [mention, own])).toEqual([own.id, mention.id]);
	});

	it('returns null for an empty query', () => {
		expect(matchNote(parseSearchQuery(''), kickoff)).toBeNull();
	});
});

describe('matchTimeEntry', () => {
	it('ranks description, description plus identity, then identity only (deliverable and work type count as identity)', () => {
		const entry = entryFields('Drafted the roles matrix', hungryroot, { deliverableName: 'Discovery', workTypeName: 'Interviews' });
		const match = (text: string) => matchTimeEntry(parseSearchQuery(text), entry);
		expect(match('roles matrix')).toEqual({ rank: SEARCH_RANK.CONTENT, matchedIn: 'description', matchedContext: [] });
		expect(match('hungryroot roles')).toMatchObject({ rank: SEARCH_RANK.CONTENT_AND_CONTEXT, matchedContext: ['clientName'] });
		expect(match('interviews')).toEqual({ rank: SEARCH_RANK.CONTEXT_ONLY, matchedIn: 'context', matchedContext: ['workTypeName'] });
		expect(match('discovery budget')).toBeNull();
	});

	it('SR-03 "Amplitude": finds an entry whose description never says Amplitude', () => {
		expect(matchTimeEntry(parseSearchQuery('amplitude'), entryFields('Call with Sam', amplitude))?.rank).toBe(SEARCH_RANK.CONTEXT_ONLY);
	});
});

describe('rankCandidates', () => {
	it('sorts by rank, then newest, then ID', () => {
		const notes = [
			candidate('B.2', 'Other', 'roles here', rankGroup, '2026-11-03T00:00:00Z'),
			candidate('A.1', 'Roles', 'x', rankGroup, '2026-01-01T00:00:00Z'),
			candidate('C.3', 'Unrelated', 'nothing', { ...rankGroup, contractName: 'Roles review' }, '2026-11-06T00:00:00Z'),
			candidate('B.1', 'Other', 'roles too', rankGroup, '2026-11-03T00:00:00Z'),
			candidate('D.4', 'Newer', 'more roles', rankGroup, '2026-11-04T00:00:00Z')
		];
		// Title, then body hits newest first (equal times by ID), then the context-only hit
		expect(rankNotes('roles', notes)).toEqual(['A.1', 'D.4', 'B.1', 'B.2', 'C.3']);
	});

	it('SR-03 no implicit scope: a query spans every client and contract', () => {
		const notes = [
			candidate('RANK.1', 'Planning', 'roles', rankGroup),
			candidate('HROOT.1', 'Planning', 'roles', hungryroot),
			candidate('AMPL.1', 'Planning', 'roles', amplitude)
		];
		expect(rankNotes('planning', notes).sort()).toEqual(['AMPL.1', 'HROOT.1', 'RANK.1']);
	});
});

describe('excerpts', () => {
	it('SR-03 metadata-only match: no highlighted body excerpt, the unhighlighted start of the body', () => {
		const note = candidate('AMPL.1', 'Event taxonomy', '# Event taxonomy\n\nFunnels and cohorts.', amplitude);
		const excerpt = noteExcerpt(note, parseSearchQuery('amplitude'));
		expect(excerpt).toEqual({ title: 'Event taxonomy', titleMatches: [], snippet: { text: 'Funnels and cohorts.', matches: [] } });
	});

	it('highlights every matched word in the body and title, a phrase as one run', () => {
		const note = candidate('HROOT.1', 'Roles workshop', '# Roles workshop\n\nWe mapped the roles for the new team.', hungryroot);
		const excerpt = noteExcerpt(note, parseSearchQuery('hungryroot roles team'));
		expect(excerpt.titleMatches).toEqual([{ start: 0, end: 5 }]);
		const marked = excerpt.snippet.matches.map((range) => excerpt.snippet.text.slice(range.start, range.end));
		expect(marked).toEqual(['roles', 'team']);
	});

	it('highlights an entry description, the phrase merged into one range', () => {
		const entry: TimeEntryCandidate = {
			id: 'e1',
			date: '2026-11-03',
			startTime: null,
			durationMinutes: 30,
			description: 'Call about the roles matrix',
			deliverableName: null,
			workTypeName: null,
			createdAt: new Date(),
			clientId: 'c',
			clientColorIndex: 0,
			contractId: 'k',
			...hungryroot
		};
		expect(timeEntryExcerpt(entry, parseSearchQuery('roles matrix'))).toEqual({
			text: 'Call about the roles matrix',
			matches: [{ start: 15, end: 27 }]
		});
	});
});
