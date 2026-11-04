/**
 * Sprint 045-CL re-review b: the same `clientRequestId` sent for two contracts at once takes two different
 * note-ID locks, so the second insert hits the unique (user_id, client_id) index. It must answer
 * with the first note, not fail.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { database, clients, contracts, notes, users } from '$lib/server/db';
import { createNoteOnce } from './notes';

describe('createNoteOnce with a clientRequestId', () => {
	const userId = `qa-045-idem-${Date.now()}`;
	const contractIds: string[] = [];
	const clientIds: string[] = [];

	beforeAll(async () => {
		await database.insert(users).values({ id: userId, name: 'QA 045', email: `${userId}@example.com` });
		for (const shortCode of ['QAIDA', 'QAIDB']) {
			const [client] = await database.insert(clients).values({ userId, name: shortCode, shortCode }).returning();
			const [contract] = await database.insert(contracts).values({ clientId: client.id, name: 'C', isActive: true }).returning();
			clientIds.push(client.id);
			contractIds.push(contract.id);
		}
	});

	afterAll(async () => {
		await database.delete(notes).where(eq(notes.userId, userId));
		for (const contractId of contractIds) await database.delete(contracts).where(eq(contracts.id, contractId));
		for (const clientId of clientIds) await database.delete(clients).where(eq(clients.id, clientId));
		await database.delete(users).where(eq(users.id, userId));
	});

	it('a repeat returns the first note unchanged', async () => {
		const first = await createNoteOnce(userId, contractIds[0], { content: 'one', clientRequestId: 'offline-0000000000000001' });
		const repeat = await createNoteOnce(userId, contractIds[0], { content: 'two', clientRequestId: 'offline-0000000000000001' });
		expect(first.created).toBe(true);
		expect(repeat).toMatchObject({ created: false, note: { id: first.note.id, content: 'one' } });
	});

	it('two creates at once on different contracts make one note, and both answer with it', async () => {
		const clientId = 'offline-0000000000000002';
		const results = await Promise.all(
			contractIds.map((contractId) => createNoteOnce(userId, contractId, { content: 'race', clientRequestId: clientId }))
		);
		expect(results.filter((result) => result.created)).toHaveLength(1);
		expect(new Set(results.map((result) => result.note.id)).size).toBe(1);
		const rows = await database.select().from(notes).where(and(eq(notes.userId, userId), eq(notes.clientRequestId, clientId)));
		expect(rows).toHaveLength(1);
	});
});
