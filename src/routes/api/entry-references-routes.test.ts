/**
 * Sprint 032-CL: every entry write path answers 400 `deliverable_mismatch` / `work_type_mismatch`
 * (handlers called directly against the dev database), and PATCH validates the merged entry.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { database, timeEntries } from '$lib/server/db';
import { createTimeEntry, getTimeEntryForUser } from '$lib/server/db/queries/time-entries';
import {
	removeEntryReferenceFixture,
	seedEntryReferenceFixture,
	type EntryReferenceFixture
} from '$lib/server/db/queries/entry-reference-fixture';
import * as timerStart from './timer/start/+server';
import * as timerSave from './timer/save/+server';
import * as timeEntriesRoute from './time-entries/+server';
import * as timeEntryRoute from './time-entries/[id]/+server';

type AnyHandler = (event: never) => Response | Promise<Response>;

let fixture: EntryReferenceFixture;

async function call(handler: AnyHandler, options: { method?: string; body: object; params?: Record<string, string> }) {
	const url = new URL('http://localhost/api/test');
	const request = new Request(url, {
		method: options.method ?? 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(options.body)
	});
	const event = { locals: { user: { id: fixture.ownerId }, session: null }, request, url, params: options.params ?? {} };
	return handler(event as never);
}

async function expectMismatch(response: Response, code: string, message?: string) {
	expect(response.status).toBe(400);
	const body = await response.json();
	expect(body.code).toBe(code);
	if (message) expect(body.error).toBe(message);
}

const STALE_WORK_TYPE = 'Work type "Interviews" belongs to deliverable "Discovery", not "Recommendations"';

beforeAll(async () => {
	fixture = await seedEntryReferenceFixture('routes');
});

afterAll(async () => {
	await removeEntryReferenceFixture(fixture);
});

describe('POST /api/time-entries', () => {
	const base = () => ({ contractId: fixture.research.id, date: '2026-11-04', duration: '1h' });

	it('400 work_type_mismatch for a work type under another deliverable', async () => {
		const response = await call(timeEntriesRoute.POST, {
			body: { ...base(), deliverableId: fixture.recommendations.id, workTypeId: fixture.interviews.id }
		});
		await expectMismatch(response, 'work_type_mismatch', STALE_WORK_TYPE);
	});

	it('400 work_type_mismatch for a work type without a deliverable', async () => {
		const response = await call(timeEntriesRoute.POST, { body: { ...base(), workTypeId: fixture.interviews.id } });
		await expectMismatch(response, 'work_type_mismatch');
	});

	it('400 deliverable_mismatch for a deliverable on another contract', async () => {
		const response = await call(timeEntriesRoute.POST, { body: { ...base(), deliverableId: fixture.support.id } });
		await expectMismatch(response, 'deliverable_mismatch', 'Deliverable "Support" belongs to contract "Retainer", not "Research"');
	});

	it('201 for a consistent entry', async () => {
		const response = await call(timeEntriesRoute.POST, {
			body: { ...base(), deliverableId: fixture.discovery.id, workTypeId: fixture.interviews.id }
		});
		expect(response.status).toBe(201);
	});
});

describe('PUT and PATCH /api/time-entries/[id] validate the merged entry', () => {
	let entryId = '';

	beforeEach(async () => {
		const entry = await createTimeEntry({
			userId: fixture.ownerId,
			contractId: fixture.research.id,
			deliverableId: fixture.discovery.id,
			workTypeId: fixture.interviews.id,
			date: '2026-11-04',
			durationMinutes: 30
		});
		entryId = entry.id;
	});

	for (const method of ['PATCH', 'PUT'] as const) {
		const handler = timeEntryRoute[method];

		it(`${method}: changing only the deliverable keeps a stale work type → 400, entry unchanged`, async () => {
			const response = await call(handler, {
				method,
				params: { id: entryId },
				body: { deliverableId: fixture.recommendations.id }
			});
			await expectMismatch(response, 'work_type_mismatch', STALE_WORK_TYPE);
			const stored = await getTimeEntryForUser(entryId, fixture.ownerId);
			expect(stored?.deliverableId).toBe(fixture.discovery.id);
		});

		it(`${method}: a work type from another deliverable → 400`, async () => {
			const response = await call(handler, { method, params: { id: entryId }, body: { workTypeId: fixture.drafting.id } });
			await expectMismatch(response, 'work_type_mismatch');
		});

		it(`${method}: clearing the deliverable but not the work type → 400`, async () => {
			const response = await call(handler, { method, params: { id: entryId }, body: { deliverableId: null } });
			await expectMismatch(response, 'work_type_mismatch');
		});

		it(`${method}: a new contract that keeps the old deliverable → 400 deliverable_mismatch`, async () => {
			const response = await call(handler, { method, params: { id: entryId }, body: { contractId: fixture.retainer.id } });
			await expectMismatch(response, 'deliverable_mismatch');
		});

		it(`${method}: a consistent change saves`, async () => {
			const response = await call(handler, {
				method,
				params: { id: entryId },
				body: { deliverableId: fixture.recommendations.id, workTypeId: fixture.drafting.id }
			});
			expect(response.status).toBe(200);
			const stored = await getTimeEntryForUser(entryId, fixture.ownerId);
			expect(stored).toMatchObject({ deliverableId: fixture.recommendations.id, workTypeId: fixture.drafting.id });
		});
	}

	it('PATCH of the description alone does not re-check references', async () => {
		const response = await call(timeEntryRoute.PATCH, { method: 'PATCH', params: { id: entryId }, body: { description: 'x' } });
		expect(response.status).toBe(200);
	});
});

describe('timer routes', () => {
	beforeEach(async () => {
		await database
			.delete(timeEntries)
			.where(and(eq(timeEntries.userId, fixture.ownerId), eq(timeEntries.isDraft, true)));
	});

	it('POST /api/timer/start: 403 for someone else’s contract', async () => {
		const response = await call(timerStart.POST, { body: { contractId: fixture.strangerContract.id } });
		expect(response.status).toBe(403);
	});

	it('POST /api/timer/save: 400 work_type_mismatch, then saves a consistent pair', async () => {
		const started = await call(timerStart.POST, { body: { contractId: fixture.research.id } });
		expect(started.status).toBe(201);
		const draft = await started.json();

		const mismatched = await call(timerSave.POST, {
			body: {
				entryId: draft.id,
				contractId: fixture.research.id,
				deliverableId: fixture.recommendations.id,
				workTypeId: fixture.interviews.id
			}
		});
		await expectMismatch(mismatched, 'work_type_mismatch', STALE_WORK_TYPE);

		const wrongContract = await call(timerSave.POST, {
			body: { entryId: draft.id, contractId: fixture.research.id, deliverableId: fixture.support.id }
		});
		await expectMismatch(wrongContract, 'deliverable_mismatch');

		const saved = await call(timerSave.POST, {
			body: {
				entryId: draft.id,
				contractId: fixture.research.id,
				deliverableId: fixture.discovery.id,
				workTypeId: fixture.interviews.id
			}
		});
		expect(saved.status).toBe(200);
		expect(await saved.json()).toMatchObject({ isDraft: false, workTypeId: fixture.interviews.id });
	});
});
