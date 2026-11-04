/**
 * Sprint 031-CL: the admin-object routes (clients, contracts, deliverables, work types), called
 * directly against the dev database. Ownership (another user's id is 404), validation (400),
 * duplicate short codes (409 `duplicate`) and the admin page's safe deletion through the API.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, notes, timeEntries, users } from '$lib/server/db';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import { decryptNullable } from '$lib/server/crypto/server-cipher';
import * as clientsRoute from './clients/+server';
import * as clientRoute from './clients/[id]/+server';
import * as contractsRoute from './contracts/+server';
import * as contractRoute from './contracts/[id]/+server';
import * as contractsByClientRoute from './contracts-by-client/+server';
import * as deliverablesRoute from './deliverables/+server';
import * as deliverableRoute from './deliverables/[id]/+server';
import * as workTypesRoute from './work-types/+server';
import * as workTypeRoute from './work-types/[id]/+server';

type AnyHandler = (event: never) => Response | Promise<Response>;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-031-owner-${suffix}`;
const strangerId = `qa-031-stranger-${suffix}`;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
let strangerClientId = '';
let strangerContractId = '';
let strangerDeliverableId = '';
let strangerWorkTypeId = '';

async function call(
	handler: AnyHandler,
	options: { userId: string; method?: string; body?: unknown; params?: Record<string, string>; query?: string }
): Promise<{ status: number; body: Json }> {
	const url = new URL(`http://localhost/api/test${options.query ?? ''}`);
	const request = new Request(url, {
		method: options.method ?? 'GET',
		headers: { 'Content-Type': 'application/json' },
		body: options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
	});
	const event = { locals: { user: { id: options.userId }, session: null }, request, url, params: options.params ?? {} };
	let response: Response;
	try {
		response = await handler(event as never);
	} catch (thrown) {
		const httpError = thrown as { status?: number; body?: { message?: string } };
		if (typeof httpError.status !== 'number') throw thrown;
		response = new Response(JSON.stringify({ error: httpError.body?.message }), { status: httpError.status });
	}
	return { status: response.status, body: await response.json() };
}

const asOwner = (handler: AnyHandler, options: Omit<Parameters<typeof call>[1], 'userId'> = {}) =>
	call(handler, { ...options, userId: ownerId });

async function seedStranger() {
	await database.insert(users).values({ id: strangerId, name: strangerId, email: `${strangerId}@example.com` });
	const client = (await call(clientsRoute.POST, { userId: strangerId, method: 'POST', body: { name: 'Stranger Co', shortCode: `QS${suffix}` } })).body.client;
	strangerClientId = client.id;
	const contract = (await call(contractsRoute.POST, { userId: strangerId, method: 'POST', body: { clientId: client.id, name: 'Secret' } })).body;
	strangerContractId = contract.id;
	strangerDeliverableId = (await call(deliverablesRoute.POST, { userId: strangerId, method: 'POST', body: { contractId: strangerContractId, name: 'Hidden' } })).body.deliverable.id;
	strangerWorkTypeId = (await call(workTypesRoute.POST, { userId: strangerId, method: 'POST', body: { deliverableId: strangerDeliverableId, name: 'Tag' } })).body.workType.id;
}

beforeAll(async () => {
	await database.insert(users).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.com` });
	await seedStranger();
});

afterAll(async () => {
	const userIds = [ownerId, strangerId];
	await database.delete(timeEntries).where(inArray(timeEntries.userId, userIds));
	await database.delete(notes).where(inArray(notes.userId, userIds));
	for (const userId of userIds) {
		const ownedClients = await database.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
		for (const client of ownedClients) await database.delete(contracts).where(eq(contracts.clientId, client.id));
		await database.delete(clients).where(eq(clients.userId, userId));
	}
	await database.delete(users).where(inArray(users.id, userIds));
});

describe('clients', () => {
	let clientId = '';

	it('creates a client with the next free colour, and refuses a duplicate short code with 409', async () => {
		const first = await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'Acme Ltd', shortCode: `QA${suffix}`, emoji: '🚀' } });
		expect(first.status).toBe(201);
		expect(first.body.client).toMatchObject({ name: 'Acme Ltd', shortCode: `QA${suffix}`, emoji: '🚀', colorIndex: 0, archived: false });
		clientId = first.body.client.id;

		const second = await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'Bolt', shortCode: `QB${suffix}` } });
		expect(second.body.client.colorIndex).toBe(1);

		const duplicate = await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'Again', shortCode: `QA${suffix}` } });
		expect(duplicate.status).toBe(409);
		expect(duplicate.body).toMatchObject({
			code: 'duplicate',
			error: `Short code “QA${suffix}” is already used by another client. Pick a different one.`
		});
	});

	it('validates the body', async () => {
		expect((await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'No code' } })).status).toBe(400);
		expect((await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'X', shortCode: 'X1', colorIndex: 9 } })).status).toBe(400);
		expect((await asOwner(clientsRoute.POST, { method: 'POST', body: '{oops' })).body.code).toBe('invalid_json');
		expect((await asOwner(clientRoute.PATCH, { method: 'PATCH', params: { id: clientId }, body: {} })).status).toBe(400);
		expect((await asOwner(clientRoute.PATCH, { method: 'PATCH', params: { id: clientId }, body: { archived: 'yes' } })).status).toBe(400);
		expect((await asOwner(clientRoute.PATCH, { method: 'PATCH', params: { id: 'nope' }, body: { name: 'X' } })).status).toBe(400);
	});

	it('edits, and a duplicate short code on edit is 409', async () => {
		const edited = await asOwner(clientRoute.PATCH, { method: 'PATCH', params: { id: clientId }, body: { name: 'Acme Limited', emoji: null } });
		expect(edited.status).toBe(200);
		expect(edited.body.client).toMatchObject({ name: 'Acme Limited', emoji: null });

		const clash = await asOwner(clientRoute.PATCH, { method: 'PATCH', params: { id: clientId }, body: { shortCode: `QB${suffix}` } });
		expect(clash.status).toBe(409);
		expect(clash.body.code).toBe('duplicate');
	});

	it('archives and unarchives; archived clients are listed only with includeArchived', async () => {
		const archived = await asOwner(clientRoute.PATCH, { method: 'PATCH', params: { id: clientId }, body: { archived: true } });
		expect(archived.body.client.archived).toBe(true);
		expect(archived.body.message).toContain('Archived client');

		const visible = await asOwner(clientsRoute.GET);
		expect(visible.body.clients.map((client: Json) => client.id)).not.toContain(clientId);
		const everything = await asOwner(clientsRoute.GET, { query: '?includeArchived=true' });
		expect(everything.body.clients.find((client: Json) => client.id === clientId).archived).toBe(true);

		const restored = await asOwner(clientRoute.PATCH, { method: 'PATCH', params: { id: clientId }, body: { archived: false } });
		expect(restored.body.client.archived).toBe(false);
	});

	it("answers 404 for another user's client on every verb, and changes nothing", async () => {
		const params = { id: strangerClientId };
		expect((await asOwner(clientRoute.GET, { params })).status).toBe(404);
		expect((await asOwner(clientRoute.PATCH, { method: 'PATCH', params, body: { name: 'Mine now' } })).status).toBe(404);
		expect((await asOwner(clientRoute.PATCH, { method: 'PATCH', params, body: { archived: true } })).status).toBe(404);
		expect((await asOwner(clientRoute.DELETE, { method: 'DELETE', params })).status).toBe(404);
		expect((await asOwner(contractsRoute.POST, { method: 'POST', body: { clientId: strangerClientId, name: 'Sneaky' } })).status).toBe(404);
		expect((await call(clientRoute.GET, { userId: strangerId, params })).body.client.name).toBe('Stranger Co');
	});
});

describe('contracts', () => {
	let clientId = '';
	let contractId = '';

	beforeAll(async () => {
		clientId = (await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'Contracting', shortCode: `QC${suffix}` } })).body.client.id;
		contractId = (await asOwner(contractsRoute.POST, { method: 'POST', body: { clientId, name: 'Website', description: '  Build it  ' } })).body.id;
	});

	it('edits name, description and isActive; archives and restores', async () => {
		const edited = await asOwner(contractRoute.PATCH, {
			method: 'PATCH',
			params: { id: contractId },
			body: { name: 'Website rebuild', description: null, isActive: false }
		});
		expect(edited.body.contract).toMatchObject({ name: 'Website rebuild', description: null, isActive: false, clientId });

		await asOwner(contractRoute.PATCH, { method: 'PATCH', params: { id: contractId }, body: { archived: true } });
		const visible = await asOwner(contractsByClientRoute.GET);
		expect(visible.body.contracts.map((row: Json) => row.id)).not.toContain(contractId);
		const everything = await asOwner(contractsByClientRoute.GET, { query: '?includeArchived=true' });
		expect(everything.body.contracts.find((row: Json) => row.id === contractId)).toMatchObject({ archived: true, clientArchived: false });

		const restored = await asOwner(contractRoute.PATCH, { method: 'PATCH', params: { id: contractId }, body: { archived: false } });
		expect(restored.body.contract.archived).toBe(false);
	});

	it('validates and answers 404 for a stranger', async () => {
		expect((await asOwner(contractRoute.PATCH, { method: 'PATCH', params: { id: contractId }, body: { name: '  ' } })).status).toBe(400);
		expect((await asOwner(contractRoute.PATCH, { method: 'PATCH', params: { id: contractId }, body: { isActive: 'no' } })).status).toBe(400);
		expect((await asOwner(contractRoute.PATCH, { method: 'PATCH', params: { id: strangerContractId }, body: { name: 'Mine' } })).status).toBe(404);
		expect((await asOwner(contractRoute.DELETE, { method: 'DELETE', params: { id: strangerContractId } })).status).toBe(404);
		expect((await asOwner(contractRoute.GET, { params: { id: MISSING_ID } })).status).toBe(404);
	});

	it('deletes safely: entries and notes move to Deleted Contract with a Formerly line', async () => {
		const entry = await createTimeEntry({ userId: ownerId, contractId, date: '2026-11-03', durationMinutes: 90, description: 'Built the header' });
		const deleted = await asOwner(contractRoute.DELETE, { method: 'DELETE', params: { id: contractId } });
		expect(deleted.status).toBe(200);
		expect(deleted.body).toMatchObject({ reassignedTimeEntryCount: 1, movedNoteCount: 0, deletedContractCount: 1, minutesMoved: 90 });
		expect(deleted.body.message).toContain('moved to Deleted Client / Deleted Contract');

		const [moved] = await database.select().from(timeEntries).where(eq(timeEntries.id, entry.id));
		expect(moved.contractId).not.toBe(contractId);
		expect(decryptNullable(moved.description, 'test')).toContain('Formerly: Contracting / Website rebuild');
		expect((await asOwner(contractRoute.GET, { params: { id: contractId } })).status).toBe(404);
	});
});

describe('deliverables and work types', () => {
	let contractId = '';
	let deliverableId = '';
	let workTypeId = '';

	beforeAll(async () => {
		const clientId = (await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'Delivering', shortCode: `QD${suffix}` } })).body.client.id;
		contractId = (await asOwner(contractsRoute.POST, { method: 'POST', body: { clientId, name: 'Retainer' } })).body.id;
	});

	it('creates, lists, edits and reads back', async () => {
		const created = await asOwner(deliverablesRoute.POST, { method: 'POST', body: { contractId, name: 'Phase 1' } });
		expect(created.status).toBe(201);
		expect(created.body.deliverable).toMatchObject({ name: 'Phase 1', sortOrder: 0, contractId });
		deliverableId = created.body.deliverable.id;

		const workType = await asOwner(workTypesRoute.POST, { method: 'POST', body: { deliverableId, name: 'Design', sortOrder: 2 } });
		expect(workType.status).toBe(201);
		workTypeId = workType.body.workType.id;

		await asOwner(deliverableRoute.PATCH, { method: 'PATCH', params: { id: deliverableId }, body: { name: 'Phase One', sortOrder: 3 } });
		await asOwner(workTypeRoute.PATCH, { method: 'PATCH', params: { id: workTypeId }, body: { name: 'UX design' } });

		const deliverableList = await asOwner(deliverablesRoute.GET, { query: `?contractId=${contractId}` });
		expect(deliverableList.body).toEqual([expect.objectContaining({ id: deliverableId, name: 'Phase One', sortOrder: 3, archived: false })]);
		const workTypeList = await asOwner(workTypesRoute.GET, { query: `?deliverableId=${deliverableId}` });
		expect(workTypeList.body).toEqual([expect.objectContaining({ id: workTypeId, name: 'UX design', sortOrder: 2 })]);
		expect((await asOwner(workTypeRoute.GET, { params: { id: workTypeId } })).body.workType).toMatchObject({ deliverableName: 'Phase One', contractId });
	});

	it('hides lists under an archived contract unless includeArchived=true', async () => {
		await asOwner(contractRoute.PATCH, { method: 'PATCH', params: { id: contractId }, body: { archived: true } });
		expect((await asOwner(deliverablesRoute.GET, { query: `?contractId=${contractId}` })).body).toEqual([]);
		expect((await asOwner(workTypesRoute.GET, { query: `?deliverableId=${deliverableId}` })).body).toEqual([]);
		const archivedList = await asOwner(deliverablesRoute.GET, { query: `?contractId=${contractId}&includeArchived=true` });
		expect(archivedList.body).toEqual([expect.objectContaining({ id: deliverableId, archived: true })]);
		await asOwner(contractRoute.PATCH, { method: 'PATCH', params: { id: contractId }, body: { archived: false } });
	});

	it('validates and answers 404 for a stranger', async () => {
		expect((await asOwner(deliverablesRoute.POST, { method: 'POST', body: { contractId, name: '' } })).status).toBe(400);
		expect((await asOwner(deliverablesRoute.POST, { method: 'POST', body: { contractId: 'nope', name: 'X' } })).status).toBe(400);
		expect((await asOwner(workTypesRoute.POST, { method: 'POST', body: { deliverableId, name: 'X', sortOrder: 1.5 } })).status).toBe(400);
		expect((await asOwner(deliverableRoute.PATCH, { method: 'PATCH', params: { id: deliverableId }, body: {} })).status).toBe(400);

		expect((await asOwner(deliverablesRoute.GET, { query: `?contractId=${strangerContractId}` })).status).toBe(404);
		expect((await asOwner(workTypesRoute.GET, { query: `?deliverableId=${strangerDeliverableId}` })).status).toBe(404);
		expect((await asOwner(deliverablesRoute.POST, { method: 'POST', body: { contractId: strangerContractId, name: 'X' } })).status).toBe(404);
		expect((await asOwner(workTypesRoute.POST, { method: 'POST', body: { deliverableId: strangerDeliverableId, name: 'X' } })).status).toBe(404);
		expect((await asOwner(deliverableRoute.PATCH, { method: 'PATCH', params: { id: strangerDeliverableId }, body: { name: 'X' } })).status).toBe(404);
		expect((await asOwner(workTypeRoute.PATCH, { method: 'PATCH', params: { id: strangerWorkTypeId }, body: { name: 'X' } })).status).toBe(404);
		expect((await asOwner(deliverableRoute.DELETE, { method: 'DELETE', params: { id: strangerDeliverableId } })).status).toBe(404);
		expect((await asOwner(workTypeRoute.DELETE, { method: 'DELETE', params: { id: strangerWorkTypeId } })).status).toBe(404);
		expect((await call(workTypeRoute.GET, { userId: strangerId, params: { id: strangerWorkTypeId } })).body.workType.name).toBe('Tag');
	});

	it('deletes a work type, then a deliverable, keeping a Formerly line on entries', async () => {
		const entry = await createTimeEntry({ userId: ownerId, contractId, deliverableId, workTypeId, date: '2026-11-03', durationMinutes: 30, description: 'Wireframes' });

		const workTypeDeleted = await asOwner(workTypeRoute.DELETE, { method: 'DELETE', params: { id: workTypeId } });
		expect(workTypeDeleted.body).toMatchObject({ annotatedTimeEntryCount: 1 });
		expect(workTypeDeleted.body.message).toBe('Deleted work type “UX design”. 1 time entry keeps “Formerly: Phase One / UX design” in the description.');

		const deliverableDeleted = await asOwner(deliverableRoute.DELETE, { method: 'DELETE', params: { id: deliverableId } });
		expect(deliverableDeleted.body).toMatchObject({ annotatedTimeEntryCount: 1 });

		const [kept] = await database.select().from(timeEntries).where(eq(timeEntries.id, entry.id));
		expect(kept).toMatchObject({ contractId, deliverableId: null, workTypeId: null });
		const description = decryptNullable(kept.description, 'test') ?? '';
		expect(description).toContain('Formerly: Phase One / UX design');
		expect(description).toContain('Formerly: Phase One');
	});
});

describe('client deletion through the API', () => {
	it('reassigns every entry to the Deleted Client and says what moved', async () => {
		const clientId = (await asOwner(clientsRoute.POST, { method: 'POST', body: { name: 'Gone Co', shortCode: `QG${suffix}` } })).body.client.id;
		const contractId = (await asOwner(contractsRoute.POST, { method: 'POST', body: { clientId, name: 'Audit' } })).body.id;
		const entry = await createTimeEntry({ userId: ownerId, contractId, date: '2026-11-02', durationMinutes: 60, description: 'Kickoff' });

		const deleted = await asOwner(clientRoute.DELETE, { method: 'DELETE', params: { id: clientId } });
		expect(deleted.status).toBe(200);
		expect(deleted.body).toMatchObject({
			deleted: { kind: 'client', id: clientId, name: 'Gone Co', shortCode: `QG${suffix}` },
			reassignedTimeEntryCount: 1,
			deletedContractCount: 1,
			minutesMoved: 60
		});
		const [moved] = await database.select().from(timeEntries).where(eq(timeEntries.id, entry.id));
		const [systemContract] = await database.select().from(contracts).where(eq(contracts.id, moved.contractId));
		expect(systemContract.isSystem).toBe(true);
		expect(decryptNullable(moved.description, 'test')).toContain('Formerly: Gone Co / Audit');
		expect((await asOwner(clientRoute.GET, { params: { id: clientId } })).status).toBe(404);
	});
});
