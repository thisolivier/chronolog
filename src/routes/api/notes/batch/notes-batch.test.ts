/**
 * Sprint 038-CL: `POST /api/notes/batch` creates (backdated or not) and updates (replace, append,
 * expectedUpdatedAt) with a result per item; `atomic` rolls everything back on the first failure;
 * more than 200 items is refused. Handlers are called directly against the dev database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database, notes } from '$lib/server/db';
import { createNoteForUser, getNoteForUser } from '$lib/server/db/queries/notes';
import { callBatch, removeBatchFixture, seedBatchFixture, type BatchFixture } from '$lib/server/batch/batch-test-fixture';
import { localDateString } from '$lib/utils/local-calendar';
import * as batchRoute from './+server';

let fixture: BatchFixture;
const post = (body: unknown, userId = fixture.ownerId) => callBatch(batchRoute.POST, userId, body);
const today = () => localDateString(new Date(), 'Europe/London');

async function notesOfOwner() {
	return database.select({ id: notes.id }).from(notes).where(eq(notes.userId, fixture.ownerId));
}

beforeAll(async () => {
	fixture = await seedBatchFixture('notes');
});

afterAll(async () => {
	await removeBatchFixture(fixture);
});

describe('POST /api/notes/batch: body', () => {
	it('400 when items is missing or not an array', async () => {
		expect((await post({})).status).toBe(400);
		expect((await post({ items: 'x' })).status).toBe(400);
		expect((await post({ items: [] })).status).toBe(400);
	});

	it('400 too_many_items above 200, and nothing is created', async () => {
		const before = (await notesOfOwner()).length;
		const items = Array.from({ length: 201 }, () => ({ contractId: fixture.research.id, title: 'x' }));
		const response = await post({ items });
		expect(response.status).toBe(400);
		expect(response.body.code).toBe('too_many_items');
		expect((await notesOfOwner()).length).toBe(before);
	});
});

describe('POST /api/notes/batch: per item', () => {
	it('creates notes, backdates one, and reports a bad item without stopping the rest', async () => {
		const response = await post({
			items: [
				{ contractId: fixture.research.id, title: 'Kickoff', content: '# Kickoff\n\nAgenda' },
				{ contractId: fixture.research.id, title: 'Back then', content: 'Old notes', createdAt: '2026-10-04' },
				{ contractId: fixture.research.id, title: 'Tomorrow', createdAt: '2999-01-01' },
				{ contractId: fixture.strangerContract.id, title: 'Not mine' },
				{ contractId: 'nope' },
				'not an object',
				{ contractId: fixture.retainer.id, title: 'Retainer note', colour: 'red' }
			]
		});
		expect(response.status).toBe(200);
		const { results, created, updated, failed } = response.body;
		expect({ created, updated, failed }).toEqual({ created: 2, updated: 0, failed: 5 });
		expect(results.map((result: { index: number }) => result.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(results[0]).toMatchObject({ ok: true, id: `${fixture.shortCode}.${today().replace(/-/g, '')}.001` });
		expect(results[1]).toMatchObject({ ok: true, id: `${fixture.shortCode}.20261004.001` });
		expect(results[2]).toMatchObject({ ok: false, code: 'invalid_date' });
		expect(results[3]).toMatchObject({ ok: false, code: 'contract_forbidden' });
		expect(results[4]).toMatchObject({ ok: false, code: 'invalid_contract' });
		expect(results[5]).toMatchObject({ ok: false, code: 'bad_request' });
		expect(results[6]).toMatchObject({ ok: false, code: 'bad_request' });
		expect(results[6].error).toContain('colour');

		const backdated = await getNoteForUser(results[1].id, fixture.ownerId);
		expect(backdated?.createdAt.toISOString().slice(0, 10)).toBe('2026-10-04');
		expect(backdated?.content).toBe('Old notes');
	});

	it('updates by id: replace, append, conflict, unknown note', async () => {
		const target = await createNoteForUser(fixture.ownerId, fixture.research.id, 'Target', '# Target\n\nFirst line');
		const other = await createNoteForUser(fixture.ownerId, fixture.research.id, 'Other', 'Old body');
		const response = await post({
			items: [
				{ id: target.id, append: 'Second line', expectedUpdatedAt: target.updatedAt.toISOString() },
				{ id: target.id, append: 'Third line' },
				{ id: other.id, title: 'Renamed', content: 'New body' },
				{ id: other.id, title: 'Stale', expectedUpdatedAt: other.updatedAt.toISOString() },
				{ id: 'NOPE.20260101.001', append: 'x' },
				{ id: target.id, content: 'a', append: 'b' }
			]
		});
		const { results, created, updated, failed } = response.body;
		expect({ created, updated, failed }).toEqual({ created: 0, updated: 3, failed: 3 });
		expect(results[0]).toMatchObject({ ok: true, id: target.id });
		expect(results[0].unconditional).toBeUndefined();
		expect(results[1]).toMatchObject({ ok: true, unconditional: true });
		expect(results[2]).toMatchObject({ ok: true, unconditional: true });
		expect(results[3]).toMatchObject({ ok: false, code: 'conflict' });
		expect(results[3].updatedAt).toBe(results[2].updatedAt);
		expect(results[4]).toMatchObject({ ok: false, code: 'note_not_found' });
		expect(results[5]).toMatchObject({ ok: false, code: 'bad_request' });

		expect((await getNoteForUser(target.id, fixture.ownerId))?.content).toBe('# Target\n\nFirst line\n\nSecond line\n\nThird line\n');
		const renamed = await getNoteForUser(other.id, fixture.ownerId);
		expect(renamed).toMatchObject({ title: 'Renamed', content: 'New body', contentJson: null });
	});

	it('cannot update another user’s note', async () => {
		const theirs = await createNoteForUser(fixture.strangerId, fixture.strangerContract.id, 'Theirs', 'Private');
		const response = await post({ items: [{ id: theirs.id, append: 'mine now' }] });
		expect(response.body.results[0]).toMatchObject({ ok: false, code: 'note_not_found' });
		expect((await getNoteForUser(theirs.id, fixture.strangerId))?.content).toBe('Private');
	});
});

describe('POST /api/notes/batch: atomic', () => {
	it('saves everything when every item is fine', async () => {
		const target = await createNoteForUser(fixture.ownerId, fixture.retainer.id, 'Atomic target', 'Start');
		const response = await post({
			atomic: true,
			items: [
				{ contractId: fixture.retainer.id, title: 'A1', content: 'one', createdAt: '2026-09-01' },
				{ contractId: fixture.retainer.id, title: 'A2', content: 'two', createdAt: '2026-09-01' },
				{ id: target.id, append: 'More', expectedUpdatedAt: target.updatedAt.toISOString() }
			]
		});
		expect(response.body).toMatchObject({ created: 2, updated: 1, failed: 0 });
		expect(response.body.results.map((result: { id: string }) => result.id)).toEqual([
			`${fixture.shortCode}.20260901.001`,
			`${fixture.shortCode}.20260901.002`,
			target.id
		]);
		expect((await getNoteForUser(target.id, fixture.ownerId))?.content).toBe('Start\n\nMore\n');
	});

	it('rolls back every item on the first failure', async () => {
		const target = await createNoteForUser(fixture.ownerId, fixture.retainer.id, 'Rollback target', 'Keep me');
		const before = (await notesOfOwner()).length;
		const response = await post({
			atomic: true,
			items: [
				{ contractId: fixture.retainer.id, title: 'R1', createdAt: '2026-08-01' },
				{ id: target.id, append: 'Never saved' },
				{ contractId: fixture.strangerContract.id, title: 'R3' },
				{ contractId: fixture.retainer.id, title: 'R4' }
			]
		});
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ created: 0, updated: 0, failed: 4 });
		const codes = response.body.results.map((result: { code: string }) => result.code);
		expect(codes).toEqual(['batch_rolled_back', 'batch_rolled_back', 'contract_forbidden', 'batch_rolled_back']);
		expect((await notesOfOwner()).length).toBe(before);
		expect((await getNoteForUser(target.id, fixture.ownerId))?.content).toBe('Keep me');
	});
});
