/**
 * E2E Tests: Clients
 *
 * Verifies that the client endpoints return the seeded "Internal" client and that
 * `PATCH /api/clients/:id` validates and persists the client colour index.
 */

import { describe, it, expect } from 'vitest';
import './test-init';
import { authGet, authPost, getSessionCookies, BASE_URL } from './helpers';

type ClientResponse = { id: string; name: string; shortCode: string; colorIndex: number };

/** Authenticated PATCH (the shared helpers only cover GET/POST/PUT/DELETE). */
async function authPatch(path: string, body: unknown): Promise<Response> {
	return fetch(`${BASE_URL}${path}`, {
		method: 'PATCH',
		headers: { Cookie: getSessionCookies().join('; '), 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		redirect: 'manual'
	});
}

async function getInternalClient(): Promise<ClientResponse> {
	const response = await authGet('/api/clients');
	expect(response.ok).toBe(true);
	const data = await response.json();
	const internalClient = data.clients.find((client: ClientResponse) => client.name === 'Internal');
	expect(internalClient).toBeDefined();
	return internalClient;
}

describe('Clients API', () => {
	it('GET /api/clients returns the seeded "Internal" client', async () => {
		const response = await authGet('/api/clients');
		expect(response.ok).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('clients');
		expect(Array.isArray(data.clients)).toBe(true);
		expect(data.clients.length).toBeGreaterThanOrEqual(1);

		const internalClient = data.clients.find(
			(client: { name: string }) => client.name === 'Internal'
		);
		expect(internalClient).toBeDefined();
		expect(internalClient).toHaveProperty('id');
		expect(typeof internalClient.id).toBe('string');
		expect(internalClient).toHaveProperty('name', 'Internal');
		expect(internalClient).toHaveProperty('shortCode');
		expect(internalClient).toHaveProperty('colorIndex');
		expect(typeof internalClient.colorIndex).toBe('number');
	});
});

describe('PATCH /api/clients/:id', () => {
	it('persists a valid colour index and returns it from GET /api/clients', async () => {
		const internalClient = await getInternalClient();

		const patchResponse = await authPatch(`/api/clients/${internalClient.id}`, { colorIndex: 3 });
		expect(patchResponse.status).toBe(200);
		const patchData = await patchResponse.json();
		expect(patchData.client).toMatchObject({ id: internalClient.id, colorIndex: 3 });

		const refreshedClient = await getInternalClient();
		expect(refreshedClient.colorIndex).toBe(3);

		// Restore the default so later test files see the seeded state.
		const restoreResponse = await authPatch(`/api/clients/${internalClient.id}`, { colorIndex: 0 });
		expect(restoreResponse.status).toBe(200);
	});

	it('rejects an out-of-range colour index (9) with 400', async () => {
		const internalClient = await getInternalClient();
		const response = await authPatch(`/api/clients/${internalClient.id}`, { colorIndex: 9 });
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toMatch(/colorIndex/);
	});

	it('rejects a non-numeric colour index with 400', async () => {
		const internalClient = await getInternalClient();
		const response = await authPatch(`/api/clients/${internalClient.id}`, { colorIndex: 'rose' });
		expect(response.status).toBe(400);
	});

	it('rejects a non-integer colour index with 400', async () => {
		const internalClient = await getInternalClient();
		const response = await authPatch(`/api/clients/${internalClient.id}`, { colorIndex: 1.5 });
		expect(response.status).toBe(400);
	});

	it('rejects an empty update with 400', async () => {
		const internalClient = await getInternalClient();
		const response = await authPatch(`/api/clients/${internalClient.id}`, {});
		expect(response.status).toBe(400);
	});

	it('returns 404 for an unknown client id', async () => {
		const response = await authPatch('/api/clients/00000000-0000-4000-8000-000000000000', {
			colorIndex: 2
		});
		expect(response.status).toBe(404);
	});

	it('returns 400 for a malformed client id', async () => {
		const response = await authPatch('/api/clients/not-a-uuid', { colorIndex: 2 });
		expect(response.status).toBe(400);
	});

	it('rejects unauthenticated requests', async () => {
		const internalClient = await getInternalClient();
		const response = await fetch(`${BASE_URL}/api/clients/${internalClient.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ colorIndex: 2 }),
			redirect: 'manual'
		});
		// hooks.server.ts redirects unauthenticated requests to /login before the route runs.
		expect([401, 303]).toContain(response.status);
	});
});

describe('Default colour of a new client (044-CL)', () => {
	async function activeColours(): Promise<number[]> {
		const data = await (await authGet('/api/clients')).json();
		return data.clients.map((client: ClientResponse) => client.colorIndex % 8);
	}
	const firstUnused = (used: number[]) => [0, 1, 2, 3, 4, 5, 6, 7].find((colour) => !used.includes(colour));
	const shortCode = () => `C${Date.now().toString(36).slice(-5).toUpperCase()}${Math.floor(Math.random() * 10)}`;

	it('takes the first colour no active client uses; archiving a client frees its colour', async () => {
		const expected = firstUnused(await activeColours());
		expect(expected).toBeDefined();
		const created = await (await authPost('/api/clients', { name: 'Colour One', shortCode: shortCode() })).json();
		expect(created.client.colorIndex).toBe(expected);

		const next = firstUnused(await activeColours());
		const second = await (await authPost('/api/clients', { name: 'Colour Two', shortCode: shortCode() })).json();
		expect(second.client.colorIndex).toBe(next);
		expect(second.client.colorIndex).not.toBe(created.client.colorIndex);

		// Archived, the first client's colour (the lowest unused one when it was made) is free again
		expect((await authPatch(`/api/clients/${created.client.id}`, { archived: true })).status).toBe(200);
		const third = await (await authPost('/api/clients', { name: 'Colour Three', shortCode: shortCode() })).json();
		expect(third.client.colorIndex).toBe(created.client.colorIndex);
	});
});
