/**
 * Sprint 029-CL route checks, calling the handlers directly against the dev database:
 * task 1 (a malformed body is a 400 `invalid_json`, never a 500) and task 4 (writes to a
 * contract the caller does not own are a 403 `contract_forbidden`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, notes, timeEntries, users } from '$lib/server/db';
import { createNoteForUser } from '$lib/server/db/queries/notes';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import * as timerDiscard from './timer/discard/+server';
import * as timerStart from './timer/start/+server';
import * as timerSave from './timer/save/+server';
import * as notesRoute from './notes/+server';
import * as noteRoute from './notes/[noteId]/+server';
import * as noteTimeEntriesRoute from './notes/[noteId]/time-entries/+server';
import * as weeklyStatusesRoute from './time-entries/weekly-statuses/+server';
import * as timeEntriesRoute from './time-entries/+server';
import * as timeEntryRoute from './time-entries/[id]/+server';

type AnyHandler = (event: never) => Response | Promise<Response>;

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-029-owner-${suffix}`;
const strangerId = `qa-029-stranger-${suffix}`;
let ownerContractId = '';
let strangerContractId = '';
let ownerNoteId = '';
let strangerEntryId = '';

async function call(
	handler: AnyHandler,
	options: { userId: string; method?: string; body?: string; params?: Record<string, string>; path?: string }
): Promise<Response> {
	const url = new URL(`http://localhost${options.path ?? '/api/test'}`);
	const request = new Request(url, {
		method: options.method ?? 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Timezone': 'Europe/London' },
		body: options.body
	});
	const event = { locals: { user: { id: options.userId }, session: null }, request, url, params: options.params ?? {} };
	try {
		return await handler(event as never);
	} catch (thrown) {
		// SvelteKit's error() throws { status, body }; hooks turn it into the JSON shape
		const httpError = thrown as { status?: number; body?: { message?: string } };
		if (typeof httpError.status === 'number') {
			return new Response(JSON.stringify({ error: httpError.body?.message }), { status: httpError.status });
		}
		throw thrown;
	}
}

async function seedUser(userId: string, shortCode: string): Promise<string> {
	await database.insert(users).values({ id: userId, name: userId, email: `${userId}@example.com` });
	const [client] = await database.insert(clients).values({ userId, name: `${userId} client`, shortCode }).returning();
	const [contract] = await database.insert(contracts).values({ clientId: client.id, name: 'Work' }).returning();
	return contract.id;
}

beforeAll(async () => {
	ownerContractId = await seedUser(ownerId, `QO${suffix}`);
	strangerContractId = await seedUser(strangerId, `QS${suffix}`);
	ownerNoteId = (await createNoteForUser(ownerId, ownerContractId, 'Owner note')).id;
	strangerEntryId = (
		await createTimeEntry({ userId: strangerId, contractId: strangerContractId, date: '2026-11-03', durationMinutes: 30 })
	).id;
});

afterAll(async () => {
	const userIds = [ownerId, strangerId];
	await database.delete(timeEntries).where(inArray(timeEntries.userId, userIds));
	await database.delete(notes).where(inArray(notes.userId, userIds));
	for (const userId of userIds) {
		const ownedClients = await database.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
		for (const client of ownedClients) {
			await database.delete(contracts).where(eq(contracts.clientId, client.id));
		}
		await database.delete(clients).where(eq(clients.userId, userId));
	}
	await database.delete(users).where(inArray(users.id, userIds));
});

describe('malformed JSON bodies are 400 invalid_json', () => {
	const cases: Array<[string, AnyHandler, string, () => Record<string, string>]> = [
		['POST /api/timer/discard', timerDiscard.POST, 'POST', () => ({})],
		['POST /api/timer/save', timerSave.POST, 'POST', () => ({})],
		['POST /api/notes', notesRoute.POST, 'POST', () => ({})],
		['PUT /api/notes/[noteId]', noteRoute.PUT, 'PUT', () => ({ noteId: ownerNoteId })],
		['POST /api/notes/[noteId]/time-entries', noteTimeEntriesRoute.POST, 'POST', () => ({ noteId: ownerNoteId })],
		['DELETE /api/notes/[noteId]/time-entries', noteTimeEntriesRoute.DELETE, 'DELETE', () => ({ noteId: ownerNoteId })],
		['POST /api/time-entries/weekly-statuses', weeklyStatusesRoute.POST, 'POST', () => ({})],
		['POST /api/time-entries', timeEntriesRoute.POST, 'POST', () => ({})],
		['PATCH /api/time-entries/[id]', timeEntryRoute.PATCH, 'PATCH', () => ({ id: strangerEntryId })]
	];

	it.each(cases)('%s', async (_label, handler, method, params) => {
		for (const badBody of ['{not json', '[1,2]', 'null']) {
			const response = await call(handler, { userId: ownerId, method, body: badBody, params: params() });
			expect(response.status).toBe(400);
			expect(await response.json()).toMatchObject({ code: 'invalid_json' });
		}
	});

	it('POST /api/timer/start (when no timer is running)', async () => {
		const response = await call(timerStart.POST, { userId: ownerId, body: 'oops' });
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ code: 'invalid_json' });
	});

	it('weekly-statuses validates year, week and status', async () => {
		const post = (body: object) =>
			call(weeklyStatusesRoute.POST, { userId: ownerId, body: JSON.stringify(body) });
		expect((await post({ year: 1999, weekNumber: 10, status: 'Submitted' })).status).toBe(400);
		expect((await post({ year: 2026, weekNumber: 54, status: 'Submitted' })).status).toBe(400);
		// ISO 2025 has 52 weeks (2026 has 53)
		expect((await post({ year: 2025, weekNumber: 53, status: 'Submitted' })).status).toBe(400);
		expect((await post({ year: 2026, weekNumber: 10, status: '  ' })).status).toBe(400);
		expect((await post({ year: 2026, weekNumber: 10, status: 'Draft ready' })).status).toBe(200);
	});
});

describe('writes to a contract the caller does not own are 403', () => {
	it('POST /api/notes', async () => {
		const response = await call(notesRoute.POST, {
			userId: ownerId,
			body: JSON.stringify({ contractId: strangerContractId, title: 'Sneaky' })
		});
		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: 'contract_forbidden' });
	});

	it('POST /api/notes on an own contract still works and uses the caller timezone', async () => {
		const response = await call(notesRoute.POST, {
			userId: ownerId,
			body: JSON.stringify({ contractId: ownerContractId, title: 'Mine' })
		});
		expect(response.status).toBe(201);
		const { note } = await response.json();
		expect(note.id).toMatch(new RegExp(`^QO${suffix}\\.\\d{8}\\.\\d{3}$`));
	});

	it('POST /api/time-entries', async () => {
		const response = await call(timeEntriesRoute.POST, {
			userId: ownerId,
			body: JSON.stringify({ contractId: strangerContractId, date: '2026-11-03', duration: '1h' })
		});
		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ code: 'contract_forbidden' });
	});

	it('PATCH /api/time-entries/[id] moving an entry to someone else’s contract', async () => {
		const created = await call(timeEntriesRoute.POST, {
			userId: ownerId,
			body: JSON.stringify({ contractId: ownerContractId, date: '2026-11-03', duration: '1h' })
		});
		expect(created.status).toBe(201);
		const { entry } = await created.json();
		const response = await call(timeEntryRoute.PATCH, {
			userId: ownerId,
			method: 'PATCH',
			params: { id: entry.id },
			body: JSON.stringify({ contractId: strangerContractId })
		});
		expect(response.status).toBe(403);
	});

	it('PATCH /api/time-entries/[id] on someone else’s entry is a 404', async () => {
		const response = await call(timeEntryRoute.PATCH, {
			userId: ownerId,
			method: 'PATCH',
			params: { id: strangerEntryId },
			body: JSON.stringify({ description: 'mine now' })
		});
		expect(response.status).toBe(404);
	});

	it('linking someone else’s entry to a note is a 404', async () => {
		const response = await call(noteTimeEntriesRoute.POST, {
			userId: ownerId,
			params: { noteId: ownerNoteId },
			body: JSON.stringify({ timeEntryId: strangerEntryId })
		});
		expect(response.status).toBe(404);
	});

	it('POST /api/timer/start', async () => {
		const response = await call(timerStart.POST, {
			userId: ownerId,
			body: JSON.stringify({ contractId: strangerContractId })
		});
		expect(response.status).toBe(403);
	});
});
