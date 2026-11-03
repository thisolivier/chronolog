/**
 * Sprint 029-CL: note IDs carry the creator's local date (tasks 2) and are allocated under an
 * advisory lock so parallel creates never collide (task 3). Runs against the dev database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database, clients, contracts, notes, users } from '$lib/server/db';
import { createNoteForUser, getNextNoteId, noteIdDate } from './notes';

describe('noteIdDate', () => {
	it('reads 23:30 Europe/London as that London day, in summer and winter', () => {
		// BST (UTC+1): 23:30 London is 22:30 UTC, same day
		expect(noteIdDate({ now: new Date('2026-07-15T22:30:00Z'), timezone: 'Europe/London' })).toBe('20260715');
		// GMT: 23:30 London is 23:30 UTC
		expect(noteIdDate({ now: new Date('2026-11-03T23:30:00Z'), timezone: 'Europe/London' })).toBe('20261103');
	});

	it('uses the local date where it differs from the UTC date', () => {
		// 00:30 BST on 16 July is still 15 July in UTC
		expect(noteIdDate({ now: new Date('2026-07-15T23:30:00Z'), timezone: 'Europe/London' })).toBe('20260716');
		// 23:30 in Los Angeles on 3 November is already 4 November in UTC
		expect(noteIdDate({ now: new Date('2026-11-04T07:30:00Z'), timezone: 'America/Los_Angeles' })).toBe('20261103');
	});
});

describe('note ID allocation', () => {
	const suffix = `${Date.now()}`.slice(-6);
	const shortCode = `Q29${suffix}`;
	const testUserId = `qa-029-notes-${suffix}`;
	let testClientId: string;
	let testContractId: string;

	beforeAll(async () => {
		await database.insert(users).values({ id: testUserId, name: 'QA 029', email: `${testUserId}@example.com` });
		const [client] = await database
			.insert(clients)
			.values({ userId: testUserId, name: 'QA 029 Client', shortCode })
			.returning();
		testClientId = client.id;
		const [contract] = await database
			.insert(contracts)
			.values({ clientId: testClientId, name: 'QA 029 Contract' })
			.returning();
		testContractId = contract.id;
	});

	afterAll(async () => {
		await database.delete(notes).where(eq(notes.userId, testUserId));
		await database.delete(contracts).where(eq(contracts.id, testContractId));
		await database.delete(clients).where(eq(clients.id, testClientId));
		await database.delete(users).where(eq(users.id, testUserId));
	});

	it('dates a note created at 23:30 Europe/London with the London day', async () => {
		const clock = { now: new Date('2026-07-15T22:30:00Z'), timezone: 'Europe/London' };
		expect(await getNextNoteId(testContractId, clock)).toBe(`${shortCode}.20260715.001`);
		const note = await createNoteForUser(testUserId, testContractId, 'Late note', undefined, undefined, clock);
		expect(note.id).toBe(`${shortCode}.20260715.001`);
	});

	it('gives eight parallel creates eight distinct, consecutive IDs', async () => {
		const clock = { now: new Date('2026-07-20T10:00:00Z'), timezone: 'Europe/London' };
		const created = await Promise.all(
			Array.from({ length: 8 }, (_, index) =>
				createNoteForUser(testUserId, testContractId, `Parallel ${index}`, undefined, undefined, clock)
			)
		);
		const ids = created.map((note) => note.id).sort();
		expect(new Set(ids).size).toBe(8);
		expect(ids).toEqual(Array.from({ length: 8 }, (_, index) => `${shortCode}.20260720.${String(index + 1).padStart(3, '0')}`));
	});

	it('orders sequences numerically past 999', async () => {
		const clock = { now: new Date('2026-07-21T10:00:00Z'), timezone: 'Europe/London' };
		await database.insert(notes).values([
			{ id: `${shortCode}.20260721.999`, userId: testUserId, contractId: testContractId },
			{ id: `${shortCode}.20260721.1000`, userId: testUserId, contractId: testContractId }
		]);
		expect(await getNextNoteId(testContractId, clock)).toBe(`${shortCode}.20260721.1001`);
	});
});
