/**
 * Sprint 038-CL: `POST /api/time-entries/batch` checks each item like `POST /api/time-entries`
 * (duration forms, dates, `assertEntryReferences`, `noteId`), reports per item, rolls back with
 * `atomic`, and refuses more than 500 items. Handlers are called directly against the dev database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database, noteTimeEntries, timeEntries } from '$lib/server/db';
import { createNoteForUser, deleteNoteForUser } from '$lib/server/db/queries/notes';
import { getTimeEntryForUser } from '$lib/server/db/queries/time-entries';
import { callBatch, removeBatchFixture, seedBatchFixture, type BatchFixture } from '$lib/server/batch/batch-test-fixture';
import * as batchRoute from './+server';

let fixture: BatchFixture;
const post = (body: unknown) => callBatch(batchRoute.POST, fixture.ownerId, body);

async function entryCount() {
	return (await database.select({ id: timeEntries.id }).from(timeEntries).where(eq(timeEntries.userId, fixture.ownerId))).length;
}

beforeAll(async () => {
	fixture = await seedBatchFixture('entries');
});

afterAll(async () => {
	await removeBatchFixture(fixture);
});

describe('POST /api/time-entries/batch', () => {
	it('400 too_many_items above 500', async () => {
		const items = Array.from({ length: 501 }, () => ({ contractId: fixture.research.id, date: '2026-10-01', duration: '1h' }));
		const response = await post({ items });
		expect(response.status).toBe(400);
		expect(response.body.code).toBe('too_many_items');
		expect(await entryCount()).toBe(0);
	});

	it('creates entries in every duration form and reports each bad item', async () => {
		const note = await createNoteForUser(fixture.ownerId, fixture.research.id, 'Interview notes', 'x');
		const response = await post({
			items: [
				{ contractId: fixture.research.id, date: '2026-10-01', duration: '1h30m', description: 'Plan', deliverableId: fixture.discovery.id, workTypeId: fixture.interviews.id },
				{ contractId: fixture.research.id, date: '2026-10-02', duration: '9:00-10:15' },
				{ contractId: fixture.research.id, date: '2026-10-03', startTime: '14:00', endTime: '15:00' },
				{ contractId: fixture.research.id, date: '2026-10-04', durationMinutes: 45, noteId: note.id, description: 'Call' },
				{ contractId: fixture.research.id, date: '2026-13-45', duration: '1h' },
				{ contractId: fixture.research.id, date: '2026-10-05', duration: 'forever' },
				{ contractId: fixture.strangerContract.id, date: '2026-10-05', duration: '1h' },
				{ contractId: fixture.research.id, date: '2026-10-05', duration: '1h', deliverableId: fixture.support.id },
				{ contractId: fixture.research.id, date: '2026-10-05', duration: '1h', workTypeId: fixture.interviews.id },
				{ contractId: fixture.research.id, date: '2026-10-05', duration: '1h', noteId: 'NOPE.20260101.001' },
				{ contractId: fixture.research.id, date: '2026-10-05' }
			]
		});
		expect(response.status).toBe(200);
		const { results, created, failed } = response.body;
		expect({ created, failed }).toEqual({ created: 4, failed: 7 });
		expect(results.slice(0, 4).every((result: { ok: boolean }) => result.ok)).toBe(true);
		expect(results.slice(4).map((result: { code: string }) => result.code)).toEqual([
			'invalid_date',
			'invalid_duration',
			'contract_forbidden',
			'deliverable_mismatch',
			'work_type_mismatch',
			'note_not_found',
			'bad_request'
		]);

		expect(await getTimeEntryForUser(results[0].id, fixture.ownerId)).toMatchObject({
			durationMinutes: 90,
			description: 'Plan',
			workTypeName: 'Interviews'
		});
		expect(await getTimeEntryForUser(results[1].id, fixture.ownerId)).toMatchObject({ durationMinutes: 75, startTime: '09:00:00' });
		expect(await getTimeEntryForUser(results[2].id, fixture.ownerId)).toMatchObject({ durationMinutes: 60, endTime: '15:00:00' });
		const linked = await getTimeEntryForUser(results[3].id, fixture.ownerId);
		expect(linked?.description).toBe(`Call [[${note.id}]]`);
		const links = await database.select().from(noteTimeEntries).where(eq(noteTimeEntries.timeEntryId, results[3].id));
		expect(links.map((link) => link.noteId)).toEqual([note.id]);
	});

	it('atomic: commits all, including note links, when every item is fine', async () => {
		const note = await createNoteForUser(fixture.ownerId, fixture.retainer.id, 'Support log', 'x');
		const response = await post({
			atomic: true,
			items: [
				{ contractId: fixture.retainer.id, date: '2026-09-01', duration: '2h', deliverableId: fixture.support.id, noteId: note.id },
				{ contractId: fixture.retainer.id, date: '2026-09-02', duration: '30m', description: `See [[${note.id}]] and [[GONE.20200101.001]]` }
			]
		});
		expect(response.body).toMatchObject({ created: 2, failed: 0 });
		const links = await database.select().from(noteTimeEntries).where(eq(noteTimeEntries.noteId, note.id));
		expect(links).toHaveLength(2);
	});

	it('atomic: a noteId in the trash is note_not_found, and a description link to it is not made (sprint 037-CL)', async () => {
		const trashed = await createNoteForUser(fixture.ownerId, fixture.retainer.id, 'Trashed log', 'x');
		await deleteNoteForUser(fixture.ownerId, trashed.id);
		const refused = await post({
			atomic: true,
			items: [{ contractId: fixture.retainer.id, date: '2026-09-03', duration: '1h', noteId: trashed.id }]
		});
		expect(refused.body.results[0]).toMatchObject({ ok: false, code: 'note_not_found' });

		const described = await post({
			atomic: true,
			items: [{ contractId: fixture.retainer.id, date: '2026-09-03', duration: '1h', description: `See [[${trashed.id}]]` }]
		});
		expect(described.body).toMatchObject({ created: 1, failed: 0 });
		const links = await database.select().from(noteTimeEntries).where(eq(noteTimeEntries.noteId, trashed.id));
		expect(links).toHaveLength(0);
	});

	it('atomic: the first failure rolls every item back', async () => {
		const before = await entryCount();
		const response = await post({
			atomic: true,
			items: [
				{ contractId: fixture.retainer.id, date: '2026-09-03', duration: '1h' },
				{ contractId: fixture.retainer.id, date: '2026-09-04', duration: '1h', deliverableId: fixture.discovery.id },
				{ contractId: fixture.retainer.id, date: '2026-09-05', duration: '1h' }
			]
		});
		expect(response.body).toMatchObject({ created: 0, failed: 3 });
		expect(response.body.results.map((result: { code: string }) => result.code)).toEqual([
			'batch_rolled_back',
			'deliverable_mismatch',
			'batch_rolled_back'
		]);
		expect(await entryCount()).toBe(before);
	});
});
