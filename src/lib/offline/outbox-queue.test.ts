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
import { loadOutboxState, MemoryStorage, saveOutboxState } from './outbox-storage';
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

	it('round-trips through storage and keeps unreadable data aside', () => {
		const storage = new MemoryStorage();
		const state = emptyOutboxState();
		queueNoteUpdate(state, { noteId: 'A', baseUpdatedAt: 't', base: null, changes: { title: 'x' }, now: NOW });
		saveOutboxState(storage, 'k', state);
		expect(loadOutboxState(storage, 'k')).toEqual(state);
		storage.setItem('k', '{not json');
		expect(loadOutboxState(storage, 'k').items).toEqual([]);
		expect(storage.key(0)).toMatch(/^k:unreadable:/);
		expect(storage.getItem(storage.key(0) as string)).toBe('{not json');
	});
});
