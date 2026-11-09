/**
 * Sprint 065-TT: `GET /api/time-entries/total` sums non-draft minutes per contract in Postgres for
 * an optional inclusive date range and a contract selection (handler called against the dev database).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import {
	removeEntryReferenceFixture,
	seedEntryReferenceFixture,
	type EntryReferenceFixture
} from '$lib/server/db/queries/entry-reference-fixture';
import { database, timeEntries } from '$lib/server/db';
import * as totalRoute from './time-entries/total/+server';

let fixture: EntryReferenceFixture;

async function getTotal(query: string, userId: string | null = fixture.ownerId) {
	const url = new URL(`http://localhost/api/time-entries/total?${query}`);
	const event = { locals: { user: userId ? { id: userId } : null, session: null }, request: new Request(url), url, params: {} };
	const response = await totalRoute.GET(event as never);
	return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
	fixture = await seedEntryReferenceFixture('total');
	const entry = (contractId: string, userId: string, date: string, durationMinutes: number) =>
		createTimeEntry({ userId, contractId, date, durationMinutes });
	await entry(fixture.research.id, fixture.ownerId, '2026-10-30', 60);
	await entry(fixture.research.id, fixture.ownerId, '2026-11-02', 90);
	await entry(fixture.research.id, fixture.ownerId, '2026-11-08', 30);
	await entry(fixture.retainer.id, fixture.ownerId, '2026-11-03', 45);
	await entry(fixture.strangerContract.id, fixture.strangerId, '2026-11-03', 600);
	// A running timer's draft never counts
	await database.insert(timeEntries).values({
		userId: fixture.ownerId,
		contractId: fixture.retainer.id,
		date: '2026-11-04',
		durationMinutes: 500,
		isDraft: true
	});
});

afterAll(async () => {
	await removeEntryReferenceFixture(fixture);
});

describe('GET /api/time-entries/total', () => {
	it('401 without a user', async () => {
		expect((await getTotal('contracts=all', null)).status).toBe(401);
	});

	it('sums every contract for all time, most minutes first, drafts and other users excluded', async () => {
		const { status, body } = await getTotal('contracts=all');
		expect(status).toBe(200);
		expect(body).toMatchObject({ from: null, to: null, totalMinutes: 225, entryCount: 4 });
		expect(body.contracts).toEqual([
			{
				contractId: fixture.research.id,
				contractName: 'Research',
				clientName: 'Acme',
				clientShortCode: expect.any(String),
				totalMinutes: 180,
				entryCount: 3
			},
			expect.objectContaining({ contractId: fixture.retainer.id, totalMinutes: 45, entryCount: 1 })
		]);
	});

	it('limits to an inclusive date range', async () => {
		const { body } = await getTotal('from=2026-11-02&to=2026-11-08&contracts=all');
		expect(body).toMatchObject({ from: '2026-11-02', to: '2026-11-08', totalMinutes: 165, entryCount: 3 });
	});

	it('takes open-ended bounds', async () => {
		expect((await getTotal('from=2026-11-03&contracts=all')).body.totalMinutes).toBe(75);
		expect((await getTotal('to=2026-11-02&contracts=all')).body.totalMinutes).toBe(150);
	});

	it('limits to the listed contracts', async () => {
		const { body } = await getTotal(`contracts=${fixture.retainer.id}`);
		expect(body.totalMinutes).toBe(45);
		expect(body.contracts).toHaveLength(1);
	});

	it('never counts another user’s contract, even when listed', async () => {
		const { body } = await getTotal(`contracts=${fixture.strangerContract.id},${fixture.research.id}`);
		expect(body.totalMinutes).toBe(180);
		expect(body.contracts.map((contract: { contractId: string }) => contract.contractId)).toEqual([fixture.research.id]);
	});

	it('an empty or missing contracts list is a zero total', async () => {
		for (const query of ['contracts=', 'from=2026-11-02']) {
			const { status, body } = await getTotal(query);
			expect(status).toBe(200);
			expect(body).toMatchObject({ totalMinutes: 0, entryCount: 0, contracts: [] });
		}
	});

	it('400 on a bad date, a reversed range or a malformed contract ID', async () => {
		expect((await getTotal('from=2026-02-30&contracts=all')).status).toBe(400);
		expect((await getTotal('to=next-week&contracts=all')).status).toBe(400);
		expect((await getTotal('from=2026-11-09&to=2026-11-01&contracts=all')).status).toBe(400);
		expect((await getTotal('contracts=not-a-uuid')).status).toBe(400);
	});
});
