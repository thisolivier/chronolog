import { describe, expect, it, vi } from 'vitest';
import { replayOutbox, type ErrorKind, type OutboxAccess, type ReplayTransport } from './outbox-replay';
import { queueEntryCreate, queueEntryDelete, queueEntryUpdate, queueNoteCreate, queueNoteUpdate } from './outbox-queue';
import { emptyOutboxState, type OutboxState } from './outbox-types';
import type { ServerNote } from './outbox-merge';

const NOW = '2026-11-04T10:00:00.000Z';
const TEMP_A = 'offline-00000000000000a1';
const TEMP_B = 'offline-00000000000000b2';

class HttpLikeError extends Error {
	constructor(readonly status: number) {
		super(`failed (${status})`);
	}
}

function memoryAccess(state: OutboxState): OutboxAccess & { state: OutboxState } {
	const access = {
		state,
		read: () => structuredClone(access.state),
		update: (mutate: (draft: OutboxState) => void) => {
			const draft = structuredClone(access.state);
			mutate(draft);
			access.state = draft;
		}
	};
	return access;
}

function classify(error: unknown): ErrorKind {
	if (error instanceof TypeError) return 'network';
	if (error instanceof HttpLikeError && error.status === 409) return 'conflict';
	return 'refused';
}

function fakeServer() {
	const notes = new Map<string, ServerNote>();
	const entries = new Map<string, Record<string, unknown>>();
	const calls: string[] = [];
	let noteCounter = 0;
	let tick = 0;
	const stamp = () => `server-${++tick}`;
	const notesByClientId = new Map<string, string>();
	const entriesByClientId = new Map<string, string>();
	const signedIn = { userId: 'owner' as string | null };
	const transport: ReplayTransport = {
		currentUserId: vi.fn(async () => signedIn.userId),
		createNote: vi.fn(async (contractId, fields, requestId) => {
			// Idempotent like the server: a repeat of a requestId returns the first note
			const existingId = notesByClientId.get(requestId);
			if (existingId) return { id: existingId, updatedAt: notes.get(existingId)!.updatedAt, created: false };
			const id = `ACME.20261104.00${++noteCounter}`;
			notesByClientId.set(requestId, id);
			calls.push(`createNote ${contractId} ${fields.content ?? '(empty)'}`);
			notes.set(id, { title: fields.title ?? null, content: fields.content ?? null, contentJson: fields.contentJson ?? null, updatedAt: stamp() });
			return { id, updatedAt: notes.get(id)!.updatedAt, created: true };
		}),
		getNote: vi.fn(async (noteId) => notes.get(noteId) ?? null),
		putNote: vi.fn(async (noteId, body) => {
			const note = notes.get(noteId);
			if (!note) throw new HttpLikeError(404);
			if (body.expectedUpdatedAt !== note.updatedAt) throw new HttpLikeError(409);
			calls.push(`putNote ${noteId} ${body.content ?? body.title}`);
			const { expectedUpdatedAt: _expected, ...fields } = body;
			notes.set(noteId, { ...note, ...fields, updatedAt: stamp() });
			return { updatedAt: notes.get(noteId)!.updatedAt };
		}),
		createEntry: vi.fn(async (input, requestId) => {
			const existingId = entriesByClientId.get(requestId);
			if (existingId) return { id: existingId, created: false, entry: { ...entries.get(existingId) } };
			const id = `entry-${entriesByClientId.size + 1}`;
			entriesByClientId.set(requestId, id);
			calls.push(`createEntry ${input.description}`);
			entries.set(id, { ...input });
			return { id, created: true, entry: { ...input } };
		}),
		getEntry: vi.fn(async (entryId) => entries.get(entryId) ?? null),
		putEntry: vi.fn(async (entryId, body) => {
			calls.push(`putEntry ${entryId}`);
			entries.set(entryId, { ...entries.get(entryId), ...body });
		}),
		deleteEntry: vi.fn(async (entryId) => {
			calls.push(`deleteEntry ${entryId}`);
			entries.delete(entryId);
		})
	};
	return { notes, entries, calls, transport, signedIn };
}

const hooks = { classifyError: classify, now: () => NOW };

describe('outbox replay', () => {
	it('creates offline notes first, then replays in order with temp IDs remapped', async () => {
		const server = fakeServer();
		server.notes.set('OLD.1', { title: null, content: 'old', contentJson: null, updatedAt: 'base' });
		const state = emptyOutboxState();
		queueNoteUpdate(state, { noteId: 'OLD.1', baseUpdatedAt: 'base', base: { content: 'old' }, changes: { content: `links [[${TEMP_B}]]` }, now: NOW });
		queueNoteCreate(state, { tempId: TEMP_A, contractId: 'C', fields: { content: `A links [[${TEMP_B}]]` }, now: NOW });
		queueNoteCreate(state, { tempId: TEMP_B, contractId: 'C', fields: { content: 'B' }, now: NOW });
		queueEntryCreate(state, {
			tempId: 'offline-00000000000000e1',
			input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C', description: `call [[${TEMP_A}]]` },
			display: {} as never,
			now: NOW
		});
		const access = memoryAccess(state);
		const remapped: string[] = [];
		const result = await replayOutbox(access, server.transport, {
			...hooks,
			onRemapped: (tempId, realId) => remapped.push(`${tempId}->${realId}`)
		});

		expect(result).toEqual({ replayed: 4, held: 0, stoppedBy: null });
		expect(access.state.items).toEqual([]);
		// A links a newer temp note, so it is created empty and filled once B has its ID
		expect(server.calls).toEqual([
			'createNote C (empty)',
			'createNote C B',
			'putNote OLD.1 links [[ACME.20261104.002]]',
			'putNote ACME.20261104.001 A links [[ACME.20261104.002]]',
			'createEntry call [[ACME.20261104.001]]'
		]);
		expect(remapped).toContain(`${TEMP_A}->ACME.20261104.001`);
		expect(access.state.idMap[TEMP_B]).toBe('ACME.20261104.002');
	});

	it('stops on a network failure and keeps everything queued', async () => {
		const server = fakeServer();
		server.transport.createEntry = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		const state = emptyOutboxState();
		queueEntryCreate(state, {
			tempId: 'offline-00000000000000e1',
			input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C' },
			display: {} as never,
			now: NOW
		});
		queueEntryUpdate(state, { entryId: 'E9', base: null, changes: { durationMinutes: 5 }, now: NOW });
		const access = memoryAccess(state);
		const result = await replayOutbox(access, server.transport, hooks);
		expect(result.stoppedBy).toBe('network');
		expect(access.state.items).toHaveLength(2);
		expect(server.transport.getEntry).not.toHaveBeenCalled();
	});

	it('holds a note changed on the server in the same field, and goes on with the rest', async () => {
		const server = fakeServer();
		server.notes.set('N.1', { title: null, content: 'edited elsewhere', contentJson: null, updatedAt: 'later' });
		server.entries.set('E1', { description: 'x', durationMinutes: 30 });
		const state = emptyOutboxState();
		queueNoteUpdate(state, { noteId: 'N.1', baseUpdatedAt: 'base', base: { content: 'original' }, changes: { content: 'mine' }, now: NOW });
		queueEntryUpdate(state, { entryId: 'E1', base: { durationMinutes: 30 }, changes: { durationMinutes: 45 }, now: NOW });
		const access = memoryAccess(state);
		const result = await replayOutbox(access, server.transport, hooks);
		expect(result).toEqual({ replayed: 1, held: 1, stoppedBy: null });
		expect(access.state.items).toHaveLength(1);
		expect(access.state.items[0]).toMatchObject({
			status: 'held',
			hold: { reason: 'conflict', conflictFields: ['content'], server: { content: 'edited elsewhere' } }
		});
		expect(server.notes.get('N.1')?.content).toBe('edited elsewhere');
		expect(server.entries.get('E1')?.durationMinutes).toBe(45);
	});

	it('holds an item the server refuses, with its message', async () => {
		const server = fakeServer();
		server.transport.createEntry = vi.fn(async () => {
			throw new HttpLikeError(403);
		});
		const state = emptyOutboxState();
		queueEntryCreate(state, {
			tempId: 'offline-00000000000000e1',
			input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C' },
			display: {} as never,
			now: NOW
		});
		const access = memoryAccess(state);
		await replayOutbox(access, server.transport, hooks);
		expect(access.state.items[0]).toMatchObject({ status: 'held', hold: { reason: 'refused' } });
		expect(access.state.items[0].hold?.message).toContain('403');
	});

	it('keeps an edit made while its request was in flight, rebased on what was sent', async () => {
		const server = fakeServer();
		server.notes.set('N.1', { title: null, content: 'base', contentJson: null, updatedAt: 'base' });
		const state = emptyOutboxState();
		queueNoteUpdate(state, { noteId: 'N.1', baseUpdatedAt: 'base', base: { content: 'base' }, changes: { content: 'first' }, now: NOW });
		const access = memoryAccess(state);
		const originalPut = server.transport.putNote;
		server.transport.putNote = vi.fn(async (noteId, body) => {
			// The user types again while the first save is on its way
			if (body.content === 'first') {
				access.update((draft) =>
					queueNoteUpdate(draft, { noteId: 'N.1', baseUpdatedAt: 'base', base: null, changes: { content: 'second' }, now: NOW })
				);
			}
			return originalPut(noteId, body);
		});
		const result = await replayOutbox(access, server.transport, hooks);
		expect(result.held).toBe(0);
		expect(server.notes.get('N.1')?.content).toBe('second');
		expect(access.state.items).toEqual([]);
	});

	it('reports which updatedAt an editor may continue from', async () => {
		const server = fakeServer();
		server.notes.set('N.1', { title: null, content: 'base', contentJson: null, updatedAt: 'base' });
		const state = emptyOutboxState();
		queueNoteUpdate(state, { noteId: 'N.1', baseUpdatedAt: 'base', base: { content: 'base' }, changes: { content: 'mine' }, now: NOW });
		const onNoteUpdated = vi.fn();
		await replayOutbox(memoryAccess(state), server.transport, { ...hooks, onNoteUpdated });
		expect(onNoteUpdated).toHaveBeenCalledWith('N.1', ['base'], server.notes.get('N.1')?.updatedAt);
	});

	it('sends the temp ID as the idempotency key, so a create whose answer was lost is not made twice (review fix 1)', async () => {
		const server = fakeServer();
		const originalCreate = server.transport.createEntry;
		let lostAnswers = 1;
		server.transport.createEntry = vi.fn(async (input, requestId) => {
			const created = await originalCreate(input, requestId);
			// The server made the entry, but the answer never arrived (TypeError, 524)
			if (lostAnswers-- > 0) throw new TypeError('Failed to fetch');
			return created;
		});
		const state = emptyOutboxState();
		const tempId = 'offline-00000000000000e1';
		queueEntryCreate(state, { tempId, input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C', description: 'once' }, display: {} as never, now: NOW });
		const access = memoryAccess(state);
		expect((await replayOutbox(access, server.transport, hooks)).stoppedBy).toBe('network');
		expect(access.state.items[0]).toMatchObject({ kind: 'entry-create' });
		expect(access.state.items[0].inFlight).toBeUndefined();
		const second = await replayOutbox(access, server.transport, hooks);
		expect(second).toMatchObject({ replayed: 1, stoppedBy: null });
		expect(server.entries.size).toBe(1);
		expect(server.transport.createEntry).toHaveBeenLastCalledWith(expect.anything(), tempId);
	});

	it('a delete made while the create was in flight deletes the created entry (review fix 2)', async () => {
		const server = fakeServer();
		const tempId = 'offline-00000000000000e2';
		const state = emptyOutboxState();
		queueEntryCreate(state, { tempId, input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C' }, display: {} as never, now: NOW });
		const access = memoryAccess(state);
		const originalCreate = server.transport.createEntry;
		server.transport.createEntry = vi.fn(async (input, requestId) => {
			// The user deletes the entry while its create is on the way
			access.update((draft) => queueEntryDelete(draft, { entryId: tempId, base: null, date: null, now: NOW }));
			return originalCreate(input, requestId);
		});
		await replayOutbox(access, server.transport, hooks);
		expect(server.calls).toContain('deleteEntry entry-1');
		expect(server.entries.size).toBe(0);
		expect(access.state.items).toEqual([]);
	});

	it('sends nothing while the server has another account signed in (review fix 5b)', async () => {
		const server = fakeServer();
		server.signedIn.userId = 'someone-else';
		const state = emptyOutboxState();
		queueEntryUpdate(state, { entryId: 'E1', base: { durationMinutes: 30 }, changes: { durationMinutes: 5 }, now: NOW });
		const access = memoryAccess(state);
		const result = await replayOutbox(access, server.transport, { ...hooks, ownerUserId: 'owner' });
		expect(result.stoppedBy).toBe('other-account');
		expect(server.transport.getEntry).not.toHaveBeenCalled();
		expect(access.state.items).toHaveLength(1);
		server.signedIn.userId = 'owner';
		server.entries.set('E1', { durationMinutes: 30 });
		expect((await replayOutbox(access, server.transport, { ...hooks, ownerUserId: 'owner' })).replayed).toBe(1);
	});

	it('a retried note create that gets the first attempt\'s older text back still sends the current text (re-review blocker)', async () => {
		const server = fakeServer();
		const state = emptyOutboxState();
		queueNoteCreate(state, { tempId: TEMP_A, contractId: 'C', fields: { content: 'first words' }, now: NOW });
		const access = memoryAccess(state);
		const originalCreate = server.transport.createNote;
		let lostAnswers = 1;
		server.transport.createNote = vi.fn(async (contractId, fields, requestId) => {
			const created = await originalCreate(contractId, fields, requestId);
			if (lostAnswers-- > 0) throw new TypeError('Failed to fetch');
			return created;
		});
		expect((await replayOutbox(access, server.transport, hooks)).stoppedBy).toBe('network');
		// Typed on while offline: folded into the queued create
		access.update((draft) => queueNoteUpdate(draft, { noteId: TEMP_A, baseUpdatedAt: NOW, base: null, changes: { content: 'first words and more' }, now: NOW }));
		await replayOutbox(access, server.transport, hooks);
		const [noteId] = [...server.notes.keys()];
		expect(server.notes.size).toBe(1);
		expect(server.notes.get(noteId)?.content).toBe('first words and more');
		expect(access.state.items).toEqual([]);
	});

	it('a retried entry create that gets the first attempt\'s row back sends the current values as an edit (re-review blocker)', async () => {
		const server = fakeServer();
		const tempId = 'offline-00000000000000e4';
		const state = emptyOutboxState();
		queueEntryCreate(state, { tempId, input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C', description: 'first' }, display: {} as never, now: NOW });
		const access = memoryAccess(state);
		const originalCreate = server.transport.createEntry;
		let lostAnswers = 1;
		server.transport.createEntry = vi.fn(async (input, requestId) => {
			const created = await originalCreate(input, requestId);
			if (lostAnswers-- > 0) throw new TypeError('Failed to fetch');
			return created;
		});
		await replayOutbox(access, server.transport, hooks);
		access.update((draft) => queueEntryUpdate(draft, { entryId: tempId, base: null, changes: { durationMinutes: 45, description: 'changed after' }, now: NOW }));
		await replayOutbox(access, server.transport, hooks);
		expect(server.entries.size).toBe(1);
		expect(server.entries.get('entry-1')).toMatchObject({ durationMinutes: 45, description: 'changed after' });
		expect(access.state.items).toEqual([]);
	});
});
