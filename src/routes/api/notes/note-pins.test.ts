/**
 * Sprint 039-CL: pinned notes and the client view. `PUT /api/notes/[id]/pin` pins and unpins without
 * touching `updatedAt`; lists put pinned notes first (most recently pinned on top), then newest
 * change; `GET /api/notes?clientId=` lists every contract of one client, the caller's only; the
 * migration's backfill turns an old `is_pinned` into a `pinned_at`. Runs against the dev database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { database, clients, contracts, notes, users } from '$lib/server/db';
import { createNoteForUser, getNoteForUser } from '$lib/server/db/queries/notes';
import { deleteNoteForUser } from '$lib/server/db/queries/note-trash';
import { createClient } from '$lib/server/db/queries/clients';
import * as pinRoute from './[noteId]/pin/+server';
import * as notesRoute from './+server';

type AnyHandler = (event: never) => Response | Promise<Response>;

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-039-pins-owner-${suffix}`;
const strangerId = `qa-039-pins-stranger-${suffix}`;
let clientId = '';
let firstContractId = '';
let secondContractId = '';
let otherClientContractId = '';

async function call(handler: AnyHandler, options: { userId: string; method?: string; path: string; noteId?: string; body?: unknown }) {
	const url = new URL(`http://localhost${options.path}`);
	const request = new Request(url, {
		method: options.method ?? 'GET',
		headers: { 'Content-Type': 'application/json' },
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	const event = { locals: { user: { id: options.userId }, session: null }, request, url, params: { noteId: options.noteId } };
	return handler(event as never);
}

const pin = (noteId: string, pinned: unknown, userId = ownerId) =>
	call(pinRoute.PUT as AnyHandler, { userId, method: 'PUT', path: `/api/notes/${noteId}/pin`, noteId, body: { pinned } });

async function listIds(query: string, userId = ownerId): Promise<string[]> {
	const response = await call(notesRoute.GET as AnyHandler, { userId, path: `/api/notes?${query}` });
	expect(response.status).toBe(200);
	return (await response.json()).notes.map((note: { id: string }) => note.id);
}

/** A note whose `updatedAt` is `minutesAgo` in the past, so list order is known */
async function noteAt(contractId: string, title: string, minutesAgo: number): Promise<string> {
	const note = await createNoteForUser(ownerId, contractId, title, `# ${title}`);
	await database.update(notes).set({ updatedAt: new Date(Date.now() - minutesAgo * 60_000) }).where(eq(notes.id, note.id));
	return note.id;
}

beforeAll(async () => {
	for (const userId of [ownerId, strangerId]) {
		await database.insert(users).values({ id: userId, name: userId, email: `${userId}@example.com` });
	}
	const client = await createClient(ownerId, 'Pins client', `QP${suffix}`);
	const otherClient = await createClient(ownerId, 'Other client', `QO${suffix}`);
	clientId = client.id;
	const created = await database
		.insert(contracts)
		.values([
			{ clientId, name: 'First' },
			{ clientId, name: 'Second' },
			{ clientId: otherClient.id, name: 'Elsewhere' }
		])
		.returning();
	[firstContractId, secondContractId, otherClientContractId] = created.map((contract) => contract.id);
});

afterAll(async () => {
	const userIds = [ownerId, strangerId];
	await database.delete(notes).where(inArray(notes.userId, userIds));
	const ownedClients = await database.select({ id: clients.id }).from(clients).where(inArray(clients.userId, userIds));
	if (ownedClients.length) await database.delete(contracts).where(inArray(contracts.clientId, ownedClients.map((client) => client.id)));
	await database.delete(clients).where(inArray(clients.userId, userIds));
	await database.delete(users).where(inArray(users.id, userIds));
});

describe('pinning a note', () => {
	it('pins first, most recently pinned on top, and keeps updatedAt', async () => {
		const oldest = await noteAt(firstContractId, 'Oldest', 30);
		const middle = await noteAt(firstContractId, 'Middle', 20);
		const newest = await noteAt(firstContractId, 'Newest', 10);
		expect(await listIds(`contractId=${firstContractId}`)).toEqual([newest, middle, oldest]);

		const before = await getNoteForUser(oldest, ownerId);
		const response = await pin(oldest, true);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.note).toMatchObject({ id: oldest, contractId: firstContractId, isPinned: true });
		expect(body.note.pinnedAt).toBeTruthy();
		expect((await getNoteForUser(oldest, ownerId))?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
		expect(await listIds(`contractId=${firstContractId}`)).toEqual([oldest, newest, middle]);

		// Pinned later sorts above pinned earlier; pinning again keeps the first pinnedAt
		await new Promise((resolve) => setTimeout(resolve, 5));
		await pin(middle, true);
		expect(await listIds(`contractId=${firstContractId}`)).toEqual([middle, oldest, newest]);
		const again = await (await pin(oldest, true)).json();
		expect(again.note.pinnedAt).toBe(body.note.pinnedAt);
		expect(await listIds(`contractId=${firstContractId}`)).toEqual([middle, oldest, newest]);

		// The list answer carries the pin
		const listed = (await (await call(notesRoute.GET as AnyHandler, { userId: ownerId, path: `/api/notes?contractId=${firstContractId}` })).json()).notes;
		expect(listed[0]).toMatchObject({ id: middle, isPinned: true });
		expect(listed[2]).toMatchObject({ id: newest, isPinned: false, pinnedAt: null });

		// Unpin: back in updatedAt order
		await pin(middle, false);
		await pin(oldest, false);
		expect(await listIds(`contractId=${firstContractId}`)).toEqual([newest, middle, oldest]);
	});

	it('refuses a bad body, a stranger and a trashed note', async () => {
		const noteId = await noteAt(firstContractId, 'Guarded', 5);
		expect((await pin(noteId, 'yes')).status).toBe(400);
		const strangerResponse = await pin(noteId, true, strangerId);
		expect(strangerResponse.status).toBe(404);
		expect((await strangerResponse.json()).code).toBe('note_not_found');
		await deleteNoteForUser(ownerId, noteId);
		expect((await pin(noteId, true)).status).toBe(404);
	});
});

describe('client view list', () => {
	it('lists every contract of the client, pinned first, and nothing of another client or user', async () => {
		const first = await noteAt(firstContractId, 'In first', 50);
		const second = await noteAt(secondContractId, 'In second', 40);
		const elsewhere = await noteAt(otherClientContractId, 'Elsewhere', 1);
		const ids = await listIds(`clientId=${clientId}`);
		expect(ids).toContain(first);
		expect(ids).toContain(second);
		expect(ids).not.toContain(elsewhere);
		expect(ids.indexOf(second)).toBeLessThan(ids.indexOf(first));

		await pin(first, true);
		expect((await listIds(`clientId=${clientId}`))[0]).toBe(first);
		await pin(first, false);

		expect(await listIds(`clientId=${clientId}`, strangerId)).toEqual([]);
		const badResponse = await call(notesRoute.GET as AnyHandler, { userId: ownerId, path: '/api/notes?clientId=nope' });
		expect(badResponse.status).toBe(400);
	});
});

describe('migration 0010 backfill', () => {
	it('gives a note pinned before 039 a pinnedAt equal to its updatedAt, and leaves others alone', async () => {
		const legacyPinned = await noteAt(secondContractId, 'Legacy pinned', 60);
		const legacyPlain = await noteAt(secondContractId, 'Legacy plain', 61);
		await database.update(notes).set({ isPinned: true, pinnedAt: null }).where(eq(notes.id, legacyPinned));
		// The statement from drizzle/0010_pinned_notes_client_order.sql, limited to this test's notes
		await database.execute(
			sql`UPDATE "notes" SET "pinned_at" = "updated_at" WHERE "is_pinned" AND "pinned_at" IS NULL AND "user_id" = ${ownerId}`
		);
		const [pinnedRow] = await database.select().from(notes).where(eq(notes.id, legacyPinned));
		const [plainRow] = await database.select().from(notes).where(eq(notes.id, legacyPlain));
		expect(pinnedRow.pinnedAt?.getTime()).toBe(pinnedRow.updatedAt.getTime());
		expect(plainRow.pinnedAt).toBeNull();
		expect((await listIds(`contractId=${secondContractId}`))[0]).toBe(legacyPinned);
	});
});
