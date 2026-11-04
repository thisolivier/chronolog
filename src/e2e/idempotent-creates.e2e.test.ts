/**
 * E2E (sprint 045-CL review fix 1): `clientId` makes POST /api/notes and POST /api/time-entries
 * idempotent. The browser's offline outbox sends its temp ID, so a create whose answer was lost and
 * is sent again returns the first row (200, same shape) instead of making a second one. Without a
 * `clientId` (the CLI) every POST creates, as before.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import './test-init';
import { authGet, authPost } from './helpers';

describe('idempotent creates with clientId', () => {
	let contractId: string;
	const today = new Date().toISOString().split('T')[0];
	const unique = () => `offline-${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`.slice(0, 24);

	beforeAll(async () => {
		const contracts = await (await authGet('/api/contracts')).json();
		contractId = contracts.find((contract: { name: string }) => contract.name === 'General').id;
	});

	it('a repeated note create returns the first note and makes no second one', async () => {
		const clientId = unique();
		const first = await authPost('/api/notes', { contractId, content: 'idempotent note', clientId });
		expect(first.status).toBe(201);
		const firstNote = (await first.json()).note;

		const repeat = await authPost('/api/notes', { contractId, content: 'idempotent note (again)', clientId });
		expect(repeat.status).toBe(200);
		const repeatNote = (await repeat.json()).note;
		expect(repeatNote.id).toBe(firstNote.id);
		expect(repeatNote.content).toBe('idempotent note');

		const list = await (await authGet(`/api/notes?contractId=${contractId}`)).json();
		expect(list.notes.filter((note: { firstLine: string }) => note.firstLine.startsWith('idempotent note'))).toHaveLength(1);
	});

	it('a repeated time entry create returns the first entry and makes no second one', async () => {
		const clientId = unique();
		const body = { contractId, date: today, durationMinutes: 17, description: `idempotent ${clientId}`, clientId };
		const first = await authPost('/api/time-entries', body);
		expect(first.status).toBe(201);
		const firstEntry = (await first.json()).entry;
		const repeat = await authPost('/api/time-entries', { ...body, durationMinutes: 99 });
		expect(repeat.status).toBe(200);
		const repeated = await repeat.json();
		expect(repeated.success).toBe(true);
		expect(repeated.entry.id).toBe(firstEntry.id);
		expect(repeated.entry.durationMinutes).toBe(17);

		const range = await (await authGet(`/api/time-entries?from=${today}&to=${today}`)).json();
		expect(range.entries.filter((entry: { description: string | null }) => entry.description === body.description)).toHaveLength(1);
	});

	it('without clientId (the CLI) each POST creates, and a malformed clientId is refused', async () => {
		const description = `cli ${unique()}`;
		const one = await authPost('/api/time-entries', { contractId, date: today, durationMinutes: 5, description });
		const two = await authPost('/api/time-entries', { contractId, date: today, durationMinutes: 5, description });
		expect(one.status).toBe(201);
		expect(two.status).toBe(201);
		expect((await one.json()).entry.id).not.toBe((await two.json()).entry.id);

		const bad = await authPost('/api/notes', { contractId, content: 'x', clientId: 'has spaces!' });
		expect(bad.status).toBe(400);
		expect((await bad.json()).code).toBe('invalid_client_id');
	});
});
