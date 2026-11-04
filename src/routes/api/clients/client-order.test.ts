/**
 * Sprint 039-CL: the manual client order. Clients start at `sort_order` 0 (the migration cannot sort
 * encrypted names), which reads by name exactly as before; `PATCH /api/clients/reorder` numbers
 * every client (listed ones first, archived ones after); `PATCH /api/clients/[id]` `position` moves
 * one; a new client lands by name until the user reorders, then last. Runs against the dev database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { database, clients, contracts, users } from '$lib/server/db';
import { createClient, listClientsForUser, setClientArchived } from '$lib/server/db/queries/clients';
import * as reorderRoute from './reorder/+server';
import * as clientRoute from './[id]/+server';
import * as contractsByClientRoute from '../contracts-by-client/+server';

type AnyHandler = (event: never) => Response | Promise<Response>;

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-039-order-owner-${suffix}`;
const strangerId = `qa-039-order-stranger-${suffix}`;
const ids: Record<string, string> = {};

async function call(handler: AnyHandler, options: { userId: string; method: string; path: string; id?: string; body?: unknown }) {
	const url = new URL(`http://localhost${options.path}`);
	const request = new Request(url, {
		method: options.method,
		headers: { 'Content-Type': 'application/json' },
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	return handler({ locals: { user: { id: options.userId }, session: null }, request, url, params: { id: options.id } } as never);
}

const names = async (userId = ownerId, includeArchived = false) =>
	(await listClientsForUser(userId, { includeArchived })).map((client) => client.name);

const reorder = (orderedIds: unknown, userId = ownerId) =>
	call(reorderRoute.PATCH as AnyHandler, { userId, method: 'PATCH', path: '/api/clients/reorder', body: { orderedIds } });

beforeAll(async () => {
	for (const userId of [ownerId, strangerId]) {
		await database.insert(users).values({ id: userId, name: userId, email: `${userId}@example.com` });
	}
	for (const [index, name] of ['Delta', 'alpha', 'Charlie', 'Bravo'].entries()) {
		ids[name] = (await createClient(ownerId, name, `QR${index}${suffix}`)).id;
	}
	ids.stranger = (await createClient(strangerId, 'Stranger', `QX${suffix}`)).id;
});

afterAll(async () => {
	const userIds = [ownerId, strangerId];
	const owned = await database.select({ id: clients.id }).from(clients).where(inArray(clients.userId, userIds));
	if (owned.length) await database.delete(contracts).where(inArray(contracts.clientId, owned.map((client) => client.id)));
	await database.delete(clients).where(inArray(clients.userId, userIds));
	await database.delete(users).where(inArray(users.id, userIds));
});

describe('client order', () => {
	it('starts in name order (the backfill: every client at 0) and new clients land by name', async () => {
		expect(await names()).toEqual(['alpha', 'Bravo', 'Charlie', 'Delta']);
		const rows = await listClientsForUser(ownerId);
		expect(rows.every((client) => client.sortOrder === 0)).toBe(true);
	});

	it('reorders: listed clients first, the archived one after; contracts-by-client carries the order', async () => {
		await setClientArchived(ids.Charlie, ownerId, true);
		const response = await reorder([ids.Delta, ids.alpha, ids.Bravo]);
		expect(response.status).toBe(200);
		expect(await names()).toEqual(['Delta', 'alpha', 'Bravo']);
		expect(await names(ownerId, true)).toEqual(['Delta', 'alpha', 'Bravo', 'Charlie']);

		await database.insert(contracts).values([{ clientId: ids.Delta, name: 'D work' }, { clientId: ids.alpha, name: 'A work' }]);
		const listed = await call(contractsByClientRoute.GET as AnyHandler, { userId: ownerId, method: 'GET', path: '/api/contracts-by-client' });
		const contractRows = (await listed.json()).contracts as { name: string; clientSortOrder: number }[];
		expect(contractRows.find((row) => row.name === 'D work')?.clientSortOrder).toBe(0);
		expect(contractRows.find((row) => row.name === 'A work')?.clientSortOrder).toBe(1);
		await setClientArchived(ids.Charlie, ownerId, false);
	});

	it('refuses duplicates, strangers’ clients and non-IDs, changing nothing', async () => {
		expect((await reorder([ids.alpha, ids.alpha])).status).toBe(400);
		expect((await reorder([ids.alpha, ids.stranger])).status).toBe(400);
		expect((await reorder('nope')).status).toBe(400);
		expect((await reorder([ids.Bravo], strangerId)).status).toBe(400);
		expect(await names()).toEqual(['Delta', 'alpha', 'Bravo', 'Charlie']);
	});

	it('moves one client to a position with PATCH /api/clients/[id] position', async () => {
		const move = (id: string, position: unknown) =>
			call(clientRoute.PATCH as AnyHandler, { userId: ownerId, method: 'PATCH', path: `/api/clients/${id}`, id, body: { position } });
		const response = await move(ids.Charlie, 1);
		expect(response.status).toBe(200);
		expect((await response.json()).message).toContain('number 1');
		expect(await names()).toEqual(['Charlie', 'Delta', 'alpha', 'Bravo']);
		await move(ids.Charlie, 99);
		expect(await names()).toEqual(['Delta', 'alpha', 'Bravo', 'Charlie']);
		expect((await move(ids.Charlie, 0)).status).toBe(400);
		expect((await move(ids.stranger, 1)).status).toBe(404);
	});

	it('puts a client created after a reorder last', async () => {
		await createClient(ownerId, 'Aardvark', `QN${suffix}`);
		expect(await names()).toEqual(['Delta', 'alpha', 'Bravo', 'Charlie', 'Aardvark']);
	});
});
