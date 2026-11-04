import { describe, expect, it } from 'vitest';
import {
	applyIdMapping,
	newTempId,
	queueEntryCreate,
	queueEntryDelete,
	queueEntryUpdate,
	queueNoteCreate,
	queueNoteUpdate,
	replaceTempIds,
	tempIdsIn
} from './outbox-queue';
import { emptyOutboxState, isTempId, type NoteUpdateItem } from './outbox-types';
import { applyOutboxChange, loadOutboxState, MemoryStorage, OutboxFullError } from './outbox-storage';
import type { TimeEntryDisplay } from '$lib/services/types';

const NOW = '2026-11-04T10:00:00.000Z';

function display(id: string, overrides: Partial<TimeEntryDisplay> = {}): TimeEntryDisplay {
	return {
		id,
		startTime: null,
		endTime: null,
		durationMinutes: 30,
		contractId: 'contract-1',
		contractName: 'Build',
		clientName: 'Acme',
		clientShortCode: 'ACME',
		clientColorIndex: 0,
		deliverableName: null,
		workTypeName: null,
		description: 'work',
		date: '2026-11-04',
		...overrides
	};
}

describe('outbox queue', () => {
	it('makes recognisable temp IDs', () => {
		const tempId = newTempId();
		expect(isTempId(tempId)).toBe(true);
		expect(tempIdsIn(`see [[${tempId}]] and [[${tempId}]]`)).toEqual([tempId]);
	});

	it('keeps items in the order of their first edit and folds later edits of a note', () => {
		const state = emptyOutboxState();
		queueNoteUpdate(state, { noteId: 'A', baseUpdatedAt: 't1', base: { title: 'old' }, changes: { title: 'one' }, now: NOW });
		queueEntryDelete(state, { entryId: 'E', base: null, date: null, now: NOW });
		queueNoteUpdate(state, {
			noteId: 'A',
			baseUpdatedAt: 't9',
			base: { title: 'newer base', content: 'body' },
			changes: { title: 'two', content: 'text' },
			now: NOW
		});
		expect(state.items.map((item) => item.kind)).toEqual(['note-update', 'entry-delete']);
		const noteItem = state.items[0] as NoteUpdateItem;
		expect(noteItem.changes).toEqual({ title: 'two', content: 'text' });
		// The oldest base wins; fields first touched later take that edit's base
		expect(noteItem.base).toEqual({ title: 'old', content: 'body' });
		expect(noteItem.baseUpdatedAt).toBe('t1');
		expect(noteItem.revision).toBe(2);
	});

	it('folds edits of a note created offline into its create', () => {
		const state = emptyOutboxState();
		queueNoteCreate(state, { tempId: 'offline-0000000000000001', contractId: 'C', fields: { content: 'a' }, now: NOW });
		queueNoteUpdate(state, { noteId: 'offline-0000000000000001', baseUpdatedAt: NOW, base: null, changes: { content: 'ab' }, now: NOW });
		expect(state.items).toHaveLength(1);
		expect(state.items[0]).toMatchObject({ kind: 'note-create', fields: { content: 'ab' } });
	});

	it('folds entry edits into an offline create and drops it when deleted', () => {
		const state = emptyOutboxState();
		const tempId = 'offline-00000000000000e1';
		queueEntryCreate(state, {
			tempId,
			input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C', description: 'x' },
			display: display(tempId),
			now: NOW
		});
		queueEntryUpdate(state, { entryId: tempId, base: null, changes: { durationMinutes: 45, description: null }, now: NOW });
		expect(state.items[0]).toMatchObject({ kind: 'entry-create', input: { durationMinutes: 45 } });
		expect('description' in (state.items[0] as { input: object }).input).toBe(false);
		queueEntryDelete(state, { entryId: tempId, base: null, date: null, now: NOW });
		expect(state.items).toHaveLength(0);
	});

	it('turns a queued entry update into the delete, keeping its place', () => {
		const state = emptyOutboxState();
		queueEntryUpdate(state, { entryId: 'E1', base: { durationMinutes: 30 }, changes: { durationMinutes: 60 }, now: NOW });
		queueNoteUpdate(state, { noteId: 'N', baseUpdatedAt: 't', base: null, changes: { title: 'x' }, now: NOW });
		queueEntryDelete(state, { entryId: 'E1', base: { durationMinutes: 30 }, date: '2026-11-04', now: NOW });
		expect(state.items.map((item) => item.kind)).toEqual(['entry-delete', 'note-update']);
		expect(queueEntryUpdate(state, { entryId: 'E1', base: null, changes: { durationMinutes: 5 }, now: NOW })).toBeNull();
	});

	it('remaps a temp ID in item IDs, wiki-links and descriptions', () => {
		const state = emptyOutboxState();
		const tempNote = 'offline-00000000000000a1';
		queueNoteCreate(state, { tempId: tempNote, contractId: 'C', fields: { content: 'new' }, now: NOW });
		queueNoteUpdate(state, {
			noteId: 'B',
			baseUpdatedAt: 't',
			base: null,
			changes: { content: `see [[${tempNote}]]`, contentJson: `{"noteId":"${tempNote}"}` },
			now: NOW
		});
		queueEntryCreate(state, {
			tempId: 'offline-00000000000000e2',
			input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C', description: `call [[${tempNote}]]` },
			display: display('x', { description: `call [[${tempNote}]]` }),
			now: NOW
		});
		applyIdMapping(state, tempNote, 'ACME.20261104.001');
		expect(state.idMap[tempNote]).toBe('ACME.20261104.001');
		expect(JSON.stringify(state.items.slice(1))).not.toContain(tempNote);
		expect(state.items[1]).toMatchObject({ changes: { content: 'see [[ACME.20261104.001]]' } });
		expect(replaceTempIds(`[[${tempNote}]]`, state.idMap)).toBe('[[ACME.20261104.001]]');
	});

	it('round-trips through storage, one key per item', () => {
		const storage = new MemoryStorage();
		const before = loadOutboxState(storage, 'p:');
		const after = structuredClone(before);
		queueNoteUpdate(after, { noteId: 'A', baseUpdatedAt: 't', base: null, changes: { title: 'x' }, now: NOW });
		after.idMap['offline-00000000000000a1'] = 'REAL.1';
		applyOutboxChange(storage, 'p:', before, after);
		const loaded = loadOutboxState(storage, 'p:');
		expect(loaded.items).toEqual(after.items);
		expect(loaded.idMap).toEqual({ 'offline-00000000000000a1': 'REAL.1' });
		expect(storage.length).toBe(2);
	});

	it('two tabs queueing at once keep both items (review fix 4)', () => {
		const storage = new MemoryStorage();
		// Both tabs read the empty queue, then each adds its own item
		const tabOneBefore = loadOutboxState(storage, 'p:');
		const tabTwoBefore = loadOutboxState(storage, 'p:');
		const tabOneAfter = structuredClone(tabOneBefore);
		queueNoteUpdate(tabOneAfter, { noteId: 'A', baseUpdatedAt: 't', base: null, changes: { title: 'one' }, now: NOW });
		const tabTwoAfter = structuredClone(tabTwoBefore);
		tabTwoAfter.nextSequence += 7;
		queueEntryDelete(tabTwoAfter, { entryId: 'E', base: null, date: null, now: NOW });
		applyOutboxChange(storage, 'p:', tabOneBefore, tabOneAfter);
		// Tab two writes from its stale read: tab one's item must survive
		applyOutboxChange(storage, 'p:', tabTwoBefore, tabTwoAfter);
		expect(loadOutboxState(storage, 'p:').items.map((item) => item.kind).sort()).toEqual(['entry-delete', 'note-update']);
	});

	it('keeps an unreadable item aside, and refuses when even that copy does not fit (review fix 7)', () => {
		const storage = new MemoryStorage();
		storage.setItem('p:item:5', '{not json');
		expect(loadOutboxState(storage, 'p:').items).toEqual([]);
		const asideKey = storage.key(0) as string;
		expect(asideKey).toMatch(/^chronolog-outbox-unreadable:p:item:5:/);
		expect(storage.getItem(asideKey)).toBe('{not json');

		const fullStorage = new MemoryStorage();
		fullStorage.setItem('p:item:6', '{not json');
		fullStorage.failWrites = true;
		expect(() => loadOutboxState(fullStorage, 'p:')).toThrow(OutboxFullError);
		expect(fullStorage.getItem('p:item:6')).toBe('{not json');
	});

	it('tags new items with the queue owner (review fix 5b)', () => {
		const state = { ...emptyOutboxState(), ownerUserId: 'user-a' };
		queueEntryDelete(state, { entryId: 'E', base: null, date: null, now: NOW });
		expect(state.items[0].ownerUserId).toBe('user-a');
	});

	it('a delete of an entry whose create is being sent is queued after it, not dropped (review fix 2)', () => {
		const state = emptyOutboxState();
		const tempId = 'offline-00000000000000e3';
		queueEntryCreate(state, { tempId, input: { date: '2026-11-04', durationMinutes: 30, contractId: 'C' }, display: display(tempId), now: NOW });
		state.items[0].inFlight = true;
		queueEntryDelete(state, { entryId: tempId, base: null, date: null, now: NOW });
		expect(state.items.map((item) => item.kind)).toEqual(['entry-create', 'entry-delete']);
		applyIdMapping(state, tempId, 'real-entry');
		expect(state.items[1]).toMatchObject({ kind: 'entry-delete', entryId: 'real-entry' });
	});
});
