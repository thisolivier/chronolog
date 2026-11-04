/**
 * Sprint 037-CL: the server-side note trash. DELETE moves a note to the trash and purges the user's
 * trash older than 30 days; restore brings it back with its ID, wiki-links and time-entry links;
 * every read (list, search, titles, backlinks, the note itself, its time entries, contract note
 * counts) skips trashed notes; POST counts markdown words. Handlers run against the dev database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, notes, users, timeEntries, noteTimeEntries } from '$lib/server/db';
import { noteLinks } from '$lib/server/db/schema/note-links';
import { createNoteForUser, getNoteForUser, listNotesForUser } from '$lib/server/db/queries/notes';
import { updateNoteLinks } from '$lib/server/db/queries/note-links';
import { listContractsByClientWithNoteCount } from '$lib/server/db/queries/contracts';
import { deleteNoteForUser, purgeExpiredTrash, trashPurgeDate, TRASH_RETENTION_DAYS } from '$lib/server/db/queries/note-trash';
import * as noteRoute from './[noteId]/+server';
import * as restoreRoute from './[noteId]/restore/+server';
import * as backlinksRoute from './[noteId]/backlinks/+server';
import * as noteTimeEntriesRoute from './[noteId]/time-entries/+server';
import * as notesRoute from './+server';
import * as trashRoute from './trash/+server';
import * as searchRoute from './search/+server';
import * as titlesRoute from './titles/+server';

type AnyHandler = (event: never) => Response | Promise<Response>;
const DAY = 24 * 60 * 60 * 1000;

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-037-trash-owner-${suffix}`;
const strangerId = `qa-037-trash-stranger-${suffix}`;
let contractId = '';
let archivedContractId = '';

async function call(
	handler: AnyHandler,
	options: { userId: string; method?: string; path?: string; noteId?: string; body?: unknown }
) {
	const url = new URL(`http://localhost${options.path ?? `/api/notes/${options.noteId ?? ''}`}`);
	const request = new Request(url, {
		method: options.method ?? 'GET',
		headers: { 'Content-Type': 'application/json' },
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

async function seedUser(userId: string, shortCode: string): Promise<string[]> {
	await database.insert(users).values({ id: userId, name: userId, email: `${userId}@example.com` });
	const [client] = await database.insert(clients).values({ userId, name: `${userId} client`, shortCode }).returning();
	const created = await database
		.insert(contracts)
		.values([{ clientId: client.id, name: 'Work' }, { clientId: client.id, name: 'Old work' }])
		.returning();
	return created.map((contract) => contract.id);
}

beforeAll(async () => {
	[contractId, archivedContractId] = await seedUser(ownerId, `QT${suffix}`);
	await seedUser(strangerId, `QS${suffix}`);
});

afterAll(async () => {
	const userIds = [ownerId, strangerId];
	await database.delete(notes).where(inArray(notes.userId, userIds));
	await database.delete(timeEntries).where(inArray(timeEntries.userId, userIds));
	for (const userId of userIds) {
		const ownedClients = await database.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
		for (const client of ownedClients) await database.delete(contracts).where(eq(contracts.clientId, client.id));
		await database.delete(clients).where(eq(clients.userId, userId));
	}
	await database.delete(users).where(inArray(users.id, userIds));
});

/** Note A, note B linking to A, and a time entry linked to A. */
async function linkedPair(label: string) {
	const target = await createNoteForUser(ownerId, contractId, `Target ${label}`, `# Target ${label}\n\nzebra${label} body`);
	const source = await createNoteForUser(ownerId, contractId, `Source ${label}`, `See [[${target.id}]]`);
	await updateNoteLinks(source.id, `See [[${target.id}]]`);
	const [entry] = await database
		.insert(timeEntries)
		.values({ userId: ownerId, contractId, date: '2026-11-04', durationMinutes: 30 })
		.returning();
	await database.insert(noteTimeEntries).values({ noteId: target.id, timeEntryId: entry.id });
	return { target, source, entryId: entry.id };
}

describe('POST /api/notes word count', () => {
	it('counts the markdown when there is no TipTap JSON', async () => {
		const response = await call(notesRoute.POST, {
			userId: ownerId, method: 'POST', path: '/api/notes',
			body: { contractId, title: 'From the CLI', content: '# From the CLI\n\n- four words of body\n' }
		});
		expect(response.status).toBe(201);
		expect((await response.json()).note.wordCount).toBe(7);
	});

	it('counts the TipTap JSON when present', async () => {
		const contentJson = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two words' }] }] });
		const response = await call(notesRoute.POST, {
			userId: ownerId, method: 'POST', path: '/api/notes',
			body: { contractId, content: 'two words but markdown has more', contentJson }
		});
		expect((await response.json()).note.wordCount).toBe(2);
	});
});

describe('DELETE, restore and the trash list', () => {
	it('DELETE moves the note to the trash: the row, its links and time-entry links stay', async () => {
		const { target, source, entryId } = await linkedPair('a');
		const response = await call(noteRoute.DELETE, { userId: ownerId, method: 'DELETE', noteId: target.id });
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({ success: true, id: target.id, title: 'Target a', contractId });
		expect(new Date(body.purgeAt).getTime() - new Date(body.deletedAt).getTime()).toBe(TRASH_RETENTION_DAYS * DAY);

		const [row] = await database.select().from(notes).where(eq(notes.id, target.id));
		expect(row.deletedAt).toBeInstanceOf(Date);
		expect(await database.select().from(noteLinks).where(eq(noteLinks.targetNoteId, target.id))).toHaveLength(1);
		expect(await database.select().from(noteTimeEntries).where(eq(noteTimeEntries.timeEntryId, entryId))).toHaveLength(1);

		// A second delete, and the stranger's restore, are 404
		expect((await call(noteRoute.DELETE, { userId: ownerId, method: 'DELETE', noteId: target.id })).status).toBe(404);
		const strangerRestore = await call(restoreRoute.POST, { userId: strangerId, method: 'POST', noteId: target.id, path: `/api/notes/${target.id}/restore` });
		expect(strangerRestore.status).toBe(404);
		expect((await strangerRestore.json()).code).toBe('not_in_trash');

		// Restore brings it back with the same ID, its link from B and its time-entry link
		const restore = await call(restoreRoute.POST, { userId: ownerId, method: 'POST', noteId: target.id, path: `/api/notes/${target.id}/restore` });
		expect(restore.status).toBe(200);
		const restored = await restore.json();
		expect(restored.note).toMatchObject({ id: target.id, title: 'Target a', deletedAt: null });
		expect(restored.contract).toMatchObject({ id: contractId, archived: false });
		const backlinks = await (await call(backlinksRoute.GET, { userId: ownerId, noteId: target.id })).json();
		expect(backlinks.backlinks.map((link: { sourceNoteId: string }) => link.sourceNoteId)).toEqual([source.id]);
		const linked = await (await call(noteTimeEntriesRoute.GET, { userId: ownerId, noteId: target.id })).json();
		expect(linked.timeEntries.map((entry: { timeEntryId: string }) => entry.timeEntryId)).toEqual([entryId]);

		// Not in the trash any more: restore again is 404
		expect((await call(restoreRoute.POST, { userId: ownerId, method: 'POST', noteId: target.id })).status).toBe(404);
	});

	it('restore onto an archived contract is allowed and reported', async () => {
		const note = await createNoteForUser(ownerId, archivedContractId, 'On the old contract', 'old');
		await call(noteRoute.DELETE, { userId: ownerId, method: 'DELETE', noteId: note.id });
		await database.update(contracts).set({ archivedAt: new Date() }).where(eq(contracts.id, archivedContractId));
		const restore = await call(restoreRoute.POST, { userId: ownerId, method: 'POST', noteId: note.id });
		expect(restore.status).toBe(200);
		expect((await restore.json()).contract).toMatchObject({ id: archivedContractId, archived: true });
		await database.update(contracts).set({ archivedAt: null }).where(eq(contracts.id, archivedContractId));
	});

	it('GET /api/notes/trash lists id, title, contract, deletedAt and the purge date; only the caller’s', async () => {
		const note = await createNoteForUser(ownerId, contractId, null as unknown as undefined, '# Listed in trash\n\nbody');
		await call(noteRoute.DELETE, { userId: ownerId, method: 'DELETE', noteId: note.id });
		const { notes: trashed } = await (await call(trashRoute.GET, { userId: ownerId, path: '/api/notes/trash' })).json();
		const entry = trashed.find((candidate: { id: string }) => candidate.id === note.id);
		expect(entry).toMatchObject({ id: note.id, title: 'Listed in trash', contractId, contract: `QT${suffix}/Work` });
		expect(new Date(entry.purgeAt).getTime()).toBe(trashPurgeDate(new Date(entry.deletedAt)).getTime());
		const { notes: theirs } = await (await call(trashRoute.GET, { userId: strangerId, path: '/api/notes/trash' })).json();
		expect(theirs).toEqual([]);
	});
});

describe('the purge window', () => {
	it('a delete purges this user’s notes trashed more than 30 days ago, with their links; younger ones stay', async () => {
		const now = new Date();
		const old = await linkedPair('old');
		const young = await createNoteForUser(ownerId, contractId, 'Young', 'young');
		const strangerOld = await createNoteForUser(strangerId, (await database.select({ id: contracts.id }).from(contracts).innerJoin(clients, eq(contracts.clientId, clients.id)).where(eq(clients.userId, strangerId)).limit(1))[0].id, 'Theirs', 'x');
		await database.update(notes).set({ deletedAt: new Date(now.getTime() - (TRASH_RETENTION_DAYS + 1) * DAY) }).where(inArray(notes.id, [old.target.id, strangerOld.id]));
		await database.update(notes).set({ deletedAt: new Date(now.getTime() - (TRASH_RETENTION_DAYS - 1) * DAY) }).where(eq(notes.id, young.id));

		const trigger = await createNoteForUser(ownerId, contractId, 'Trigger', 'x');
		expect(await deleteNoteForUser(ownerId, trigger.id, now)).not.toBeNull();

		const remaining = await database.select({ id: notes.id }).from(notes).where(inArray(notes.id, [old.target.id, young.id, trigger.id, strangerOld.id]));
		expect(remaining.map((row) => row.id).sort()).toEqual([young.id, trigger.id, strangerOld.id].sort());
		expect(await database.select().from(noteLinks).where(eq(noteLinks.targetNoteId, old.target.id))).toHaveLength(0);
		expect(await database.select().from(noteTimeEntries).where(eq(noteTimeEntries.noteId, old.target.id))).toHaveLength(0);
		// The source note that linked to the purged one is untouched
		expect(await getNoteForUser(old.source.id, ownerId)).not.toBeNull();
	});

	it('exactly at the edge nothing is purged; one millisecond past, it is', async () => {
		const note = await createNoteForUser(ownerId, contractId, 'Edge', 'edge');
		const deletedAt = new Date(Date.now() - 5 * DAY);
		await database.update(notes).set({ deletedAt }).where(eq(notes.id, note.id));
		const edge = trashPurgeDate(deletedAt);
		expect(await purgeExpiredTrash(ownerId, edge)).not.toContain(note.id);
		expect(await purgeExpiredTrash(ownerId, new Date(edge.getTime() + 1))).toContain(note.id);
	});
});

describe('reads skip trashed notes', () => {
	it('list, search, titles, backlinks, the note, its time entries, PUT and contract note counts', async () => {
		const { target, source } = await linkedPair('hidden');
		const countBefore = (await listContractsByClientWithNoteCount(ownerId)).find((contract) => contract.id === contractId)!.noteCount;

		// B is trashed: A's backlinks hide it
		await deleteNoteForUser(ownerId, source.id);
		const backlinks = await (await call(backlinksRoute.GET, { userId: ownerId, noteId: target.id })).json();
		expect(backlinks.backlinks).toEqual([]);

		await deleteNoteForUser(ownerId, target.id);
		const listed = await (await call(notesRoute.GET, { userId: ownerId, path: `/api/notes?contractId=${contractId}` })).json();
		expect(listed.notes.map((note: { id: string }) => note.id)).not.toContain(target.id);
		expect((await listNotesForUser(ownerId, { updatedSince: new Date(0) })).map((note) => note.id)).not.toContain(target.id);

		const searched = await (await call(searchRoute.GET, { userId: ownerId, path: '/api/notes/search?q=zebrahidden' })).json();
		expect(searched.notes).toEqual([]);
		const byId = await (await call(searchRoute.GET, { userId: ownerId, path: `/api/notes/search?q=${target.id}` })).json();
		expect(byId.notes).toEqual([]);

		const titles = await (await call(titlesRoute.GET, { userId: ownerId, path: `/api/notes/titles?ids=${target.id}` })).json();
		expect(titles.titles).toEqual([]);
		const withDeleted = await (await call(titlesRoute.GET, { userId: ownerId, path: `/api/notes/titles?ids=${target.id},${source.id}&includeDeleted=1` })).json();
		expect(withDeleted.titles).toHaveLength(2);
		expect(withDeleted.titles.every((title: { deletedAt: string | null }) => title.deletedAt)).toBe(true);
		const strangerTitles = await (await call(titlesRoute.GET, { userId: strangerId, path: `/api/notes/titles?ids=${target.id}&includeDeleted=1` })).json();
		expect(strangerTitles.titles).toEqual([]);

		const trashedGet = await call(noteRoute.GET, { userId: ownerId, noteId: target.id });
		expect(trashedGet.status).toBe(404);
		expect((await trashedGet.json()).code).toBe('note_in_trash');
		// Someone else gets the plain 404: the trash is not revealed
		const strangerGet = await call(noteRoute.GET, { userId: strangerId, noteId: target.id });
		expect(strangerGet.status).toBe(404);
		expect((await strangerGet.json()).code).not.toBe('note_in_trash');
		expect((await call(noteTimeEntriesRoute.GET, { userId: ownerId, noteId: target.id })).status).toBe(404);
		expect((await call(noteRoute.PUT, { userId: ownerId, method: 'PUT', noteId: target.id, body: { title: 'x' } })).status).toBe(404);

		const countAfter = (await listContractsByClientWithNoteCount(ownerId)).find((contract) => contract.id === contractId)!.noteCount;
		expect(countAfter).toBe(countBefore - 2);

		// The rows are still there for a restore
		const rows = await database.select({ id: notes.id }).from(notes).where(and(eq(notes.userId, ownerId), inArray(notes.id, [target.id, source.id])));
		expect(rows).toHaveLength(2);
	});
});
