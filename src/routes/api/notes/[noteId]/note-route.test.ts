/**
 * Sprint 034-CL: `PUT` with markdown only clears the stale TipTap JSON, `PATCH` needs
 * `expectedUpdatedAt` and answers 409 on a stale copy, moves check contract ownership, and
 * `DELETE` returns what it deleted; `POST /api/notes` with `createdAt` backdates a note (task 6). Handlers are called directly against the dev database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, notes, users } from '$lib/server/db';
import { createNoteForUser, getNoteForUser } from '$lib/server/db/queries/notes';
import * as noteRoute from './+server';
import * as notesRoute from '../+server';
import { localDateString } from '$lib/utils/local-calendar';

type AnyHandler = (event: never) => Response | Promise<Response>;

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-034-owner-${suffix}`;
const strangerId = `qa-034-stranger-${suffix}`;
let ownerContractId = '';
let ownerSecondContractId = '';
let strangerContractId = '';

const browserJson = JSON.stringify({
	type: 'doc',
	content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Typed in the browser' }] }]
});

async function call(handler: AnyHandler, options: { userId: string; method: string; noteId: string; body?: unknown; timezone?: string }) {
	const url = new URL(`http://localhost/api/notes/${options.noteId}`);
	const request = new Request(url, {
		method: options.method,
		headers: { 'Content-Type': 'application/json', ...(options.timezone ? { 'X-Timezone': options.timezone } : {}) },
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	const event = { locals: { user: { id: options.userId }, session: null }, request, url, params: { noteId: options.noteId } };
	try {
		return await handler(event as never);
	} catch (thrown) {
		const httpError = thrown as { status?: number; body?: { message?: string } };
		if (typeof httpError.status === 'number') {
			return new Response(JSON.stringify({ error: httpError.body?.message }), { status: httpError.status });
		}
		throw thrown;
	}
}

async function seedUser(userId: string, shortCode: string, contractNames: string[]): Promise<string[]> {
	await database.insert(users).values({ id: userId, name: userId, email: `${userId}@example.com` });
	const [client] = await database.insert(clients).values({ userId, name: `${userId} client`, shortCode }).returning();
	const created = await database
		.insert(contracts)
		.values(contractNames.map((name) => ({ clientId: client.id, name })))
		.returning();
	return created.map((contract) => contract.id);
}

/** A note the browser has saved: markdown and TipTap JSON together. */
async function browserNote(title: string) {
	const note = await createNoteForUser(ownerId, ownerContractId, title, 'Typed in the browser', browserJson);
	expect(note.contentJson).toBe(browserJson);
	return note;
}

beforeAll(async () => {
	[ownerContractId, ownerSecondContractId] = await seedUser(ownerId, `QN${suffix}`, ['Work', 'Other work']);
	[strangerContractId] = await seedUser(strangerId, `QX${suffix}`, ['Theirs']);
});

afterAll(async () => {
	const userIds = [ownerId, strangerId];
	await database.delete(notes).where(inArray(notes.userId, userIds));
	for (const userId of userIds) {
		const ownedClients = await database.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
		for (const client of ownedClients) await database.delete(contracts).where(eq(contracts.clientId, client.id));
		await database.delete(clients).where(eq(clients.userId, userId));
	}
	await database.delete(users).where(inArray(users.id, userIds));
});

describe('PUT /api/notes/[noteId]', () => {
	it('keeps the browser behaviour: content and contentJson saved together', async () => {
		const note = await browserNote('Both fields');
		const nextJson = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] }] });
		const response = await call(noteRoute.PUT, {
			userId: ownerId, method: 'PUT', noteId: note.id,
			body: { content: 'one two three', contentJson: nextJson, expectedUpdatedAt: note.updatedAt }
		});
		expect(response.status).toBe(200);
		const { note: saved } = await response.json();
		expect(saved).toMatchObject({ content: 'one two three', contentJson: nextJson, wordCount: 3 });
	});

	it('markdown without contentJson clears the stale TipTap document and counts the markdown', async () => {
		const note = await browserNote('Markdown only');
		const response = await call(noteRoute.PUT, {
			userId: ownerId, method: 'PUT', noteId: note.id,
			body: { content: '# From the CLI\n\nFour words of body\n' }
		});
		expect(response.status).toBe(200);
		const stored = await getNoteForUser(note.id, ownerId);
		expect(stored).toMatchObject({ content: '# From the CLI\n\nFour words of body\n', contentJson: null, wordCount: 7 });
	});

	it('a title-only change leaves both bodies alone', async () => {
		const note = await browserNote('Title only');
		const response = await call(noteRoute.PUT, { userId: ownerId, method: 'PUT', noteId: note.id, body: { title: 'Renamed' } });
		expect(response.status).toBe(200);
		expect(await getNoteForUser(note.id, ownerId)).toMatchObject({ title: 'Renamed', contentJson: browserJson });
	});

	it('an explicit contentJson null clears it', async () => {
		const note = await browserNote('Clear json');
		const response = await call(noteRoute.PUT, { userId: ownerId, method: 'PUT', noteId: note.id, body: { contentJson: null } });
		expect(response.status).toBe(200);
		expect(await getNoteForUser(note.id, ownerId)).toMatchObject({ content: 'Typed in the browser', contentJson: null });
	});

	it('refuses a move to someone else’s contract', async () => {
		const note = await browserNote('Move away');
		const response = await call(noteRoute.PUT, { userId: ownerId, method: 'PUT', noteId: note.id, body: { contractId: strangerContractId } });
		expect(response.status).toBe(403);
		expect((await response.json()).code).toBe('contract_forbidden');
	});
});

describe('PATCH /api/notes/[noteId]', () => {
	it('requires expectedUpdatedAt', async () => {
		const note = await browserNote('Needs a copy');
		const response = await call(noteRoute.PATCH, { userId: ownerId, method: 'PATCH', noteId: note.id, body: { title: 'x' } });
		expect(response.status).toBe(400);
		expect((await response.json()).code).toBe('expected_updated_at_required');
		expect((await getNoteForUser(note.id, ownerId))?.title).toBe('Needs a copy');
	});

	it('applies a partial change based on a fresh copy, then refuses the now-stale copy with 409', async () => {
		const note = await browserNote('Patch me');
		const fresh = await call(noteRoute.PATCH, {
			userId: ownerId, method: 'PATCH', noteId: note.id,
			body: { content: 'Typed in the browser\n\nAppended line\n', expectedUpdatedAt: note.updatedAt }
		});
		expect(fresh.status).toBe(200);
		const { note: patched } = await fresh.json();
		expect(patched).toMatchObject({ title: 'Patch me', contentJson: null, wordCount: 6 });

		const stale = await call(noteRoute.PATCH, {
			userId: ownerId, method: 'PATCH', noteId: note.id,
			body: { title: 'Lost', expectedUpdatedAt: note.updatedAt }
		});
		expect(stale.status).toBe(409);
		const conflict = await stale.json();
		expect(conflict.error).toBe('conflict');
		expect(new Date(conflict.updatedAt).getTime()).toBe(new Date(patched.updatedAt).getTime());
		expect((await getNoteForUser(note.id, ownerId))?.title).toBe('Patch me');
	});

	it('moves a note to another of the caller’s contracts and keeps its ID', async () => {
		const note = await browserNote('Moving');
		const response = await call(noteRoute.PATCH, {
			userId: ownerId, method: 'PATCH', noteId: note.id,
			body: { contractId: ownerSecondContractId, expectedUpdatedAt: note.updatedAt }
		});
		expect(response.status).toBe(200);
		expect((await response.json()).note).toMatchObject({ id: note.id, contractId: ownerSecondContractId });
	});

	it('refuses someone else’s contract (403) and someone else’s note (404)', async () => {
		const note = await browserNote('Stays');
		const forbidden = await call(noteRoute.PATCH, {
			userId: ownerId, method: 'PATCH', noteId: note.id,
			body: { contractId: strangerContractId, expectedUpdatedAt: note.updatedAt }
		});
		expect(forbidden.status).toBe(403);
		const notTheirs = await call(noteRoute.PATCH, {
			userId: strangerId, method: 'PATCH', noteId: note.id,
			body: { title: 'Mine now', expectedUpdatedAt: note.updatedAt }
		});
		expect(notTheirs.status).toBe(404);
		expect(await getNoteForUser(note.id, ownerId)).toMatchObject({ title: 'Stays', contractId: ownerContractId });
	});
});

describe('DELETE /api/notes/[noteId]', () => {
	it('returns the deleted note’s id, title and contract', async () => {
		const note = await browserNote('Delete me');
		const response = await call(noteRoute.DELETE, { userId: ownerId, method: 'DELETE', noteId: note.id });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ success: true, id: note.id, title: 'Delete me', contractId: ownerContractId });
		expect(await getNoteForUser(note.id, ownerId)).toBeNull();

		const again = await call(noteRoute.DELETE, { userId: ownerId, method: 'DELETE', noteId: note.id });
		expect(again.status).toBe(404);
	});

	it('is a 404 for someone else’s note, which stays', async () => {
		const note = await browserNote('Not yours');
		const response = await call(noteRoute.DELETE, { userId: strangerId, method: 'DELETE', noteId: note.id });
		expect(response.status).toBe(404);
		expect(await getNoteForUser(note.id, ownerId)).not.toBeNull();
	});
});

describe('POST /api/notes with createdAt (backdated note)', () => {
	const create = (createdAt: unknown, timezone = 'America/Los_Angeles') =>
		call(notesRoute.POST, { userId: ownerId, method: 'POST', noteId: '', timezone, body: { contractId: ownerContractId, title: 'Backdated', createdAt } });

	it('uses the date for the ID prefix and noon of that day in the caller’s timezone for created_at', async () => {
		const before = Date.now();
		const response = await create('2026-01-15');
		expect(response.status).toBe(201);
		const { note } = await response.json();
		expect(note.id).toMatch(new RegExp(`^QN${suffix}\\.20260115\\.\\d{3}$`));
		expect(new Date(note.createdAt).toISOString()).toBe('2026-01-15T20:00:00.000Z');
		expect(new Date(note.updatedAt).getTime()).toBeGreaterThanOrEqual(before - 5_000);

		const london = await (await create('2026-07-01', 'Europe/London')).json();
		expect(london.note.id).toContain('.20260701.');
		expect(new Date(london.note.createdAt).toISOString()).toBe('2026-07-01T11:00:00.000Z');
	});

	it('today is the same as no date', async () => {
		const today = localDateString(new Date(), 'America/Los_Angeles');
		const { note } = await (await create(today)).json();
		expect(note.id).toContain(`.${today.replace(/-/g, '')}.`);
		expect(Math.abs(new Date(note.createdAt).getTime() - Date.now())).toBeLessThan(60_000);
	});

	it('refuses a future day and anything that is not a calendar date with 400 invalid_date', async () => {
		const tomorrow = localDateString(new Date(Date.now() + 36 * 3600_000), 'Pacific/Kiritimati');
		for (const bad of [tomorrow, '2026-02-30', 'yesterday', 20260115]) {
			const response = await create(bad, 'Pacific/Kiritimati');
			expect(response.status, String(bad)).toBe(400);
			expect((await response.json()).code).toBe('invalid_date');
		}
	});
});
