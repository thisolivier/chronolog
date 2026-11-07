/**
 * Sprint 058-DR: the shared search matcher over HTTP. `GET /api/search` and the `[[` picker
 * (`GET /api/notes/search`) find records by client/contract identity, combine identity with
 * content words, still find a note by its ID, return the same note order for the same query,
 * and the picker's empty query lists recent notes across every contract.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import './test-init';
import { authGet, authPatch, authPost } from './helpers';

const run = Date.now().toString(36);
const amplitudeName = `Amplitude${run}`;
const hungryrootName = `Hungryroot${run}`;
const zeta = `zeta${run}`;

type NoteHit = {
	id: string;
	rank: number;
	matchedIn: string;
	matchedContext: string[];
	titleMatches: { start: number; end: number }[];
	snippet: { text: string; matches: { start: number; end: number }[] };
	clientName: string;
	clientShortCode: string;
	clientColorIndex: number;
	contractName: string;
};

const ids = { amplitudeContract: '', hungryrootContract: '', zetaContract: '' };
const createdClientIds: string[] = [];
const noteIds = { taxonomy: '', hungryrootRoles: '', hungryrootBudget: '', amplitudeRoles: '', zetaKickoff: '' };
let entryId = '';

async function createContract(name: string, body: Record<string, unknown>) {
	const response = await authPost('/api/contracts', { name, ...body });
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string; clientId: string };
}

async function createNote(contractId: string, title: string, content: string): Promise<string> {
	const response = await authPost('/api/notes', { contractId, title, content });
	expect(response.status).toBe(201);
	return (await response.json()).note.id;
}

async function globalSearch(query: string, limit = 50) {
	const response = await authGet(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
	expect(response.status).toBe(200);
	return response.json();
}

async function pickerSearch(query: string, extra = '') {
	const response = await authGet(`/api/notes/search?q=${encodeURIComponent(query)}${extra}`);
	expect(response.status).toBe(200);
	return (await response.json()).notes as NoteHit[];
}

beforeAll(async () => {
	const amplitude = await createContract(`Analytics ${run}`, { newClient: { name: amplitudeName, shortCode: `AM${run.slice(-6).toUpperCase()}` } });
	ids.amplitudeContract = amplitude.id;
	createdClientIds.push(amplitude.clientId);
	const hungryroot = await createContract(`Org design ${run}`, { newClient: { name: hungryrootName, shortCode: `HR${run.slice(-6).toUpperCase()}` } });
	ids.hungryrootContract = hungryroot.id;
	createdClientIds.push(hungryroot.clientId);
	ids.zetaContract = (await createContract(`Zeta${run} programme`, { clientId: hungryroot.clientId })).id;

	// Creation order matters: later notes are newer. Four fillers first, so the run has nine notes
	// and the picker's default limit of 8 can be seen cutting the list
	for (let index = 1; index <= 4; index++) await createNote(ids.hungryrootContract, `Filler ${index} ${run}`, 'Nothing to see.');
	noteIds.taxonomy = await createNote(ids.amplitudeContract, `Event taxonomy ${run}`, `# Event taxonomy ${run}\n\nFunnels and cohorts.`);
	noteIds.hungryrootRoles = await createNote(ids.hungryrootContract, `Workshop ${run}`, `We mapped the roles for ${zeta}.`);
	noteIds.hungryrootBudget = await createNote(ids.hungryrootContract, `Budget ${run}`, `Only the budget for ${zeta}.`);
	noteIds.amplitudeRoles = await createNote(ids.amplitudeContract, `Roles ${zeta}`, 'Roles at Amplitude-free length.');
	noteIds.zetaKickoff = await createNote(ids.zetaContract, `Kickoff ${run}`, 'Agenda and attendees.');

	const entryResponse = await authPost('/api/time-entries', {
		contractId: ids.amplitudeContract,
		date: '2026-11-02',
		durationMinutes: 30,
		description: `Call with Sam ${run}`
	});
	expect(entryResponse.status).toBe(201);
	entryId = (await entryResponse.json()).entry.id;
});

// The run's test user is shared by every e2e file: archive these clients so they do not use up
// the active client colours another file counts (clients.e2e.test.ts)
afterAll(async () => {
	for (const clientId of createdClientIds) await authPatch(`/api/clients/${clientId}`, { archived: true });
});

describe('shared search matcher (SR-03)', () => {
	it('"Amplitude" finds notes and entries whose text never says it, with no invented highlight', async () => {
		const result = await globalSearch(amplitudeName);
		const noteHits = result.notes.hits as NoteHit[];
		expect(noteHits.map((hit) => hit.id).sort()).toEqual([noteIds.amplitudeRoles, noteIds.taxonomy].sort());
		const taxonomy = noteHits.find((hit) => hit.id === noteIds.taxonomy)!;
		expect(taxonomy).toMatchObject({ rank: 6, matchedIn: 'context', matchedContext: ['clientName'], clientName: amplitudeName });
		expect(taxonomy.snippet).toEqual({ text: 'Funnels and cohorts.', matches: [] });
		expect(taxonomy.titleMatches).toEqual([]);
		expect(typeof taxonomy.clientColorIndex).toBe('number');

		expect(result.timeEntries.total).toBe(1);
		expect(result.timeEntries.hits[0]).toMatchObject({ id: entryId, rank: 6, matchedIn: 'context', matchedContext: ['clientName'] });
		expect(result.timeEntries.hits[0].snippet.matches).toEqual([]);
	});

	it('"Hungryroot roles" combines client identity with the roles content', async () => {
		const result = await globalSearch(`${hungryrootName} roles`);
		expect(result.notes.hits.map((hit: NoteHit) => hit.id)).toEqual([noteIds.hungryrootRoles]);
		const [hit] = result.notes.hits as NoteHit[];
		expect(hit).toMatchObject({ rank: 4, matchedIn: 'body', matchedContext: ['clientName'] });
		expect(hit.snippet.matches.map((range) => hit.snippet.text.slice(range.start, range.end))).toEqual(['roles']);

		const picker = await pickerSearch(`${hungryrootName} roles`);
		expect(picker.map((note) => note.id)).toEqual([noteIds.hungryrootRoles]);
	});

	it("a note's stable code still finds that note first, on both surfaces", async () => {
		const result = await globalSearch(noteIds.hungryrootRoles.toLowerCase());
		expect(result.notes.hits[0]).toMatchObject({ id: noteIds.hungryrootRoles, rank: 0, matchedIn: 'id' });
		const picker = await pickerSearch(noteIds.hungryrootRoles);
		expect(picker[0]).toMatchObject({ id: noteIds.hungryrootRoles, rank: 0 });
	});

	it('returns the same note order from /api/search and the picker for the same query', async () => {
		const expected = [noteIds.amplitudeRoles, noteIds.hungryrootBudget, noteIds.hungryrootRoles, noteIds.zetaKickoff];
		const result = await globalSearch(zeta);
		const searchOrder = (result.notes.hits as NoteHit[]).map((hit) => hit.id);
		const pickerOrder = (await pickerSearch(zeta)).map((note) => note.id);
		expect(searchOrder).toEqual(expected);
		expect(pickerOrder).toEqual(expected);
		expect((result.notes.hits as NoteHit[]).map((hit) => hit.rank)).toEqual([2, 5, 5, 6]);
		expect((result.notes.hits as NoteHit[])[3].matchedContext).toEqual(['contractName']);
	});

	it('keeps the /api/search response fields the CLI reads', async () => {
		const result = await globalSearch(zeta, 2);
		expect(result).toMatchObject({ query: zeta, minimumQueryLength: 2, notes: { total: 4 }, timeEntries: { total: 0 } });
		expect(result.notes.hits).toHaveLength(2);
		for (const key of ['id', 'title', 'matchedIn', 'titleMatches', 'snippet', 'updatedAt', 'clientShortCode', 'contractName', 'clientId', 'contractId']) {
			expect(result.notes.hits[0]).toHaveProperty(key);
		}
	});
});

describe('picker recent notes (SR-04)', () => {
	it('an empty query with recent=1 lists the newest notes across every contract, 8 by default', async () => {
		const recent = await pickerSearch('', '&recent=1&limit=3');
		expect(recent.map((note) => note.id)).toEqual([noteIds.zetaKickoff, noteIds.amplitudeRoles, noteIds.hungryrootBudget]);
		expect(new Set(recent.map((note) => note.contractName)).size).toBe(3);
		expect(recent[0]).toMatchObject({ rank: null, matchedIn: null });

		expect(await pickerSearch('', '&recent=1')).toHaveLength(8);
		// All nine notes of this run match its stamp; the default limit returns eight of them
		expect(await pickerSearch(run)).toHaveLength(8);
		expect(await pickerSearch(run, '&limit=20')).toHaveLength(9);
	});

	it('an empty query without recent=1 still returns nothing', async () => {
		expect(await pickerSearch('')).toEqual([]);
	});
});
