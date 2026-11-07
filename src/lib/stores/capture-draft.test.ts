import { beforeEach, describe, expect, it } from 'vitest';
import { captureDraftStorageKey, captureKeyFor, intervalKeyFor, readCaptureDraft, type CaptureDraftFields } from './capture-draft';
import { CaptureDraftStore } from './capture-draft.svelte';

function memoryStorage(): Storage {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => [...values.keys()][index] ?? null,
		removeItem: (key) => void values.delete(key),
		setItem: (key, value) => void values.set(key, String(value))
	};
}

const initialFields: CaptureDraftFields = {
	contractId: 'contract-a',
	deliverableId: '',
	workTypeId: '',
	description: 'Typed while running',
	timeText: '09:00-10:30',
	measuredTimeText: '09:00-10:30'
};
const INTERVAL = intervalKeyFor({ date: '2026-11-07', startTime: '09:00:05', endTime: '10:30:12', durationMinutes: 91 });

describe('capture draft keys', () => {
	it('keys a server draft by id and a browser timer by its start', () => {
		expect(captureKeyFor({ entryId: 'abc', date: '2026-11-07', startTime: '09:00:05' })).toBe('entry:abc');
		expect(captureKeyFor({ entryId: '', date: '2026-11-07', startTime: '09:00:05' })).toBe('pending:2026-11-07T09:00:05');
	});

	it('ignores a malformed stored record', () => {
		const storage = memoryStorage();
		storage.setItem(captureDraftStorageKey('user-1'), '{"captureKey":"entry:x"}');
		expect(readCaptureDraft(storage, 'user-1')).toBeNull();
		storage.setItem(captureDraftStorageKey('user-1'), 'not json');
		expect(readCaptureDraft(storage, 'user-1')).toBeNull();
	});
});

describe('CaptureDraftStore', () => {
	let storage: Storage;

	beforeEach(() => {
		storage = memoryStorage();
	});

	it('persists edits and restores them in a fresh store (a remount or reload)', () => {
		const first = new CaptureDraftStore();
		first.configure('user-1', storage);
		first.open('entry:abc', INTERVAL, initialFields);
		first.fields.deliverableId = 'deliverable-1';
		first.fields.workTypeId = 'work-type-1';
		first.fields.description = 'Edited after Stop';
		first.fields.timeText = '1h 15m';
		first.persist();

		const second = new CaptureDraftStore();
		second.configure('user-1', storage);
		// What the server knows is older than what the user typed: the stored fields win
		second.open('entry:abc', INTERVAL, initialFields);
		expect(second.captureKey).toBe('entry:abc');
		expect(second.fields).toEqual({
			...initialFields,
			deliverableId: 'deliverable-1',
			workTypeId: 'work-type-1',
			description: 'Edited after Stop',
			timeText: '1h 15m'
		});
	});

	it('a changed server interval (split, resume, move) resets the time text and keeps the rest', () => {
		const first = new CaptureDraftStore();
		first.configure('user-1', storage);
		first.open('entry:abc', INTERVAL, initialFields);
		first.fields.description = 'Typed after Stop';
		first.fields.deliverableId = 'deliverable-1';
		first.fields.timeText = '1h';
		first.persist();

		// Another device split the entry: same id, new start
		const splitInterval = intervalKeyFor({ date: '2026-11-07', startTime: '10:00:00', endTime: '10:30:12', durationMinutes: 31 });
		expect(splitInterval).not.toBe(INTERVAL);
		const fromServer = { ...initialFields, timeText: '10:00-10:30', measuredTimeText: '10:00-10:30' };
		const second = new CaptureDraftStore();
		second.configure('user-1', storage);
		second.open('entry:abc', splitInterval, fromServer);
		expect(second.fields.timeText).toBe('10:00-10:30');
		expect(second.fields.measuredTimeText).toBe('10:00-10:30');
		expect(second.fields.description).toBe('Typed after Stop');
		expect(second.fields.deliverableId).toBe('deliverable-1');
		expect(readCaptureDraft(storage, 'user-1')?.intervalKey).toBe(splitInterval);

		// The same store instance (no reload) also follows the new interval
		first.open('entry:abc', splitInterval, fromServer);
		expect(first.fields.timeText).toBe('10:00-10:30');
		expect(first.fields.description).toBe('Typed after Stop');
	});

	it('replaces a record that belongs to another capture', () => {
		const first = new CaptureDraftStore();
		first.configure('user-1', storage);
		first.open('entry:old', INTERVAL, { ...initialFields, description: 'Old capture' });

		const second = new CaptureDraftStore();
		second.configure('user-1', storage);
		second.open('entry:new', INTERVAL, initialFields);
		expect(second.fields.description).toBe('Typed while running');
		expect(readCaptureDraft(storage, 'user-1')?.captureKey).toBe('entry:new');
	});

	it('keeps one record per user', () => {
		const forUserOne = new CaptureDraftStore();
		forUserOne.configure('user-1', storage);
		forUserOne.open('entry:abc', INTERVAL, initialFields);

		const forUserTwo = new CaptureDraftStore();
		forUserTwo.configure('user-2', storage);
		expect(readCaptureDraft(storage, 'user-2')).toBeNull();
		forUserTwo.open('entry:abc', INTERVAL, { ...initialFields, description: 'Other account' });
		expect(readCaptureDraft(storage, 'user-1')?.description).toBe('Typed while running');
	});

	it('clear (Save or Discard) forgets the fields in memory and storage', () => {
		const store = new CaptureDraftStore();
		store.configure('user-1', storage);
		store.open('entry:abc', INTERVAL, initialFields);
		store.clear();
		expect(store.captureKey).toBeNull();
		expect(store.fields.description).toBe('');
		expect(readCaptureDraft(storage, 'user-1')).toBeNull();

		const reopened = new CaptureDraftStore();
		reopened.configure('user-1', storage);
		reopened.open('entry:abc', INTERVAL, { ...initialFields, description: 'From the server' });
		expect(reopened.fields.description).toBe('From the server');
	});

	it('works without storage (private mode): fields live for the page', () => {
		const store = new CaptureDraftStore();
		store.configure('user-1', null);
		store.open('entry:abc', INTERVAL, initialFields);
		store.fields.description = 'Kept in memory';
		store.persist();
		store.open('entry:abc', INTERVAL, initialFields);
		expect(store.fields.description).toBe('Kept in memory');
	});
});
