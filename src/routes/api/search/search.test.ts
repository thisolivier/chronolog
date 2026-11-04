/**
 * Sprint 042-CL: GET /api/search against the dev database. Title hits rank above body hits,
 * time entries match on their description, trashed notes and other users' data never come back,
 * short queries return nothing, snippets carry match offsets.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, notes, users, timeEntries } from '$lib/server/db';
import { createNoteForUser } from '$lib/server/db/queries/notes';
import { deleteNoteForUser } from '$lib/server/db/queries/note-trash';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import * as searchRoute from './+server';

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-042-search-owner-${suffix}`;
const strangerId = `qa-042-search-stranger-${suffix}`;
const word = `quokka${suffix}`;
let ownerContractId = '';
let strangerContractId = '';

async function search(userId: string, query: string, limit?: number) {
	const url = new URL(`http://localhost/api/search?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`);
	const event = { locals: { user: { id: userId }, session: null }, request: new Request(url), url };
	const response = await searchRoute.GET(event as never);
	return { status: response.status, body: await response.json() };
}

async function seedUser(userId: string, shortCode: string) {
	await database.insert(users).values({ id: userId, name: userId, email: `${userId}@example.com` });
	const [client] = await database.insert(clients).values({ userId, name: `${userId} client`, shortCode }).returning();
	const [contract] = await database.insert(contracts).values({ clientId: client.id, name: 'Search work' }).returning();
	return contract.id;
}

let titleNoteId = '';
let bodyNoteId = '';
let trashedNoteId = '';
let entryId = '';

beforeAll(async () => {
	ownerContractId = await seedUser(ownerId, `QA${suffix}`);
	strangerContractId = await seedUser(strangerId, `QB${suffix}`);
	// Body hit created last (newest), so only ranking can put the title hit first
	titleNoteId = (await createNoteForUser(ownerId, ownerContractId, `Plan for ${word}`, 'Nothing else here')).id;
	trashedNoteId = (await createNoteForUser(ownerId, ownerContractId, `Old ${word}`, 'gone')).id;
	await deleteNoteForUser(ownerId, trashedNoteId);
	bodyNoteId = (
		await createNoteForUser(ownerId, ownerContractId, 'Weekly notes', `# Weekly\n\nWe talked about the **${word}** budget at length.`)
	).id;
	entryId = (
		await createTimeEntry({ userId: ownerId, contractId: ownerContractId, date: '2026-11-03', durationMinutes: 45, description: `Call about ${word} rollout` })
	).id;
	await createNoteForUser(strangerId, strangerContractId, `Stranger ${word}`, word);
	await createTimeEntry({ userId: strangerId, contractId: strangerContractId, date: '2026-11-03', durationMinutes: 30, description: `Stranger ${word}` });
});

afterAll(async () => {
	const userIds = [ownerId, strangerId];
	await database.delete(notes).where(inArray(notes.userId, userIds));
	await database.delete(timeEntries).where(inArray(timeEntries.userId, userIds));
	for (const contractId of [ownerContractId, strangerContractId]) {
		const [contract] = await database.select().from(contracts).where(eq(contracts.id, contractId));
		await database.delete(contracts).where(eq(contracts.id, contractId));
		await database.delete(clients).where(eq(clients.id, contract.clientId));
	}
	await database.delete(users).where(inArray(users.id, userIds));
});

describe('GET /api/search', () => {
	it('ranks a title hit above a newer body hit and excludes the trash', async () => {
		const { status, body } = await search(ownerId, word.toUpperCase());
		expect(status).toBe(200);
		expect(body.notes.hits.map((hit: { id: string }) => hit.id)).toEqual([titleNoteId, bodyNoteId]);
		expect(body.notes.total).toBe(2);
		const [titleHit, bodyHit] = body.notes.hits;
		expect(titleHit.matchedIn).toBe('title');
		expect(titleHit.title.slice(titleHit.titleMatches[0].start, titleHit.titleMatches[0].end)).toBe(word);
		expect(bodyHit.matchedIn).toBe('body');
		expect(bodyHit.contractName).toBe('Search work');
		expect(bodyHit.clientShortCode).toBe(`QA${suffix}`);
	});

	it('returns a markdown-free body snippet with match offsets', async () => {
		const { body } = await search(ownerId, word);
		const bodyHit = body.notes.hits.find((hit: { id: string }) => hit.id === bodyNoteId);
		expect(bodyHit.snippet.text).toBe(`Weekly We talked about the ${word} budget at length.`);
		const [match] = bodyHit.snippet.matches;
		expect(bodyHit.snippet.text.slice(match.start, match.end)).toBe(word);
	});

	it('starts the snippet after a heading that repeats the title', async () => {
		const kiwi = `kiwi${suffix}`;
		await createNoteForUser(ownerId, ownerContractId, `Heading ${kiwi}`, `# Heading ${kiwi}\n\nThe body text.`);
		const { body } = await search(ownerId, kiwi);
		expect(body.notes.hits[0].snippet).toEqual({ text: 'The body text.', matches: [] });
	});

	it('finds time entries by description, with date, client and contract', async () => {
		const { body } = await search(ownerId, `${word} rollout`);
		expect(body.notes.hits).toEqual([]);
		expect(body.timeEntries.hits).toHaveLength(1);
		const [hit] = body.timeEntries.hits;
		expect(hit).toMatchObject({ id: entryId, date: '2026-11-03', durationMinutes: 45, contractId: ownerContractId });
		expect(hit.snippet.text).toBe(`Call about ${word} rollout`);
		expect(hit.snippet.matches).toEqual([{ start: 11, end: 11 + word.length + 8 }]);
	});

	it("never returns another user's notes or entries", async () => {
		const { body } = await search(ownerId, 'Stranger');
		expect(body.notes.hits).toEqual([]);
		expect(body.timeEntries.hits).toEqual([]);
		const stranger = await search(strangerId, word);
		expect(stranger.body.notes.hits).toHaveLength(1);
		expect(stranger.body.notes.hits[0].title).toBe(`Stranger ${word}`);
		expect(stranger.body.timeEntries.hits).toHaveLength(1);
	});

	it('returns nothing for a query under two characters, and caps the limit', async () => {
		const { body } = await search(ownerId, 'q');
		expect(body.notes).toEqual({ hits: [], total: 0 });
		expect(body.timeEntries).toEqual({ hits: [], total: 0 });
		const limited = await search(ownerId, word, 1);
		expect(limited.body.notes.hits).toHaveLength(1);
		expect(limited.body.notes.total).toBe(2);
	});

	it('refuses an over-long query and an anonymous caller', async () => {
		expect((await search(ownerId, 'x'.repeat(201))).status).toBe(400);
		const url = new URL('http://localhost/api/search?q=abc');
		await expect(searchRoute.GET({ locals: { user: null }, request: new Request(url), url } as never)).rejects.toMatchObject({ status: 401 });
	});
});
