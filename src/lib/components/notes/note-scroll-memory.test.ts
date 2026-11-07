import { describe, expect, it } from 'vitest';
import {
	MAX_REMEMBERED_NOTES,
	NOTE_POSITIONS_KEY,
	clampSelection,
	createHistoryReturnTracker,
	noteIdOfWorkspacePath,
	readNotePosition,
	rememberNotePosition
} from './note-scroll-memory';

class MemoryStorage implements Storage {
	private values = new Map<string, string>();
	get length() {
		return this.values.size;
	}
	clear() {
		this.values.clear();
	}
	getItem(key: string) {
		return this.values.get(key) ?? null;
	}
	key(index: number) {
		return [...this.values.keys()][index] ?? null;
	}
	removeItem(key: string) {
		this.values.delete(key);
	}
	setItem(key: string, value: string) {
		this.values.set(key, value);
	}
}

const CONTRACT = '11111111-1111-4111-8111-111111111111';
const position = (scrollTop: number) => ({ scrollTop, selectionFrom: 5, selectionTo: 9 });

describe('note position storage', () => {
	it('remembers and reads a position per note', () => {
		const storage = new MemoryStorage();
		rememberNotePosition(storage, 'AMP.20261105.006', position(420));
		rememberNotePosition(storage, 'AMP.20261105.007', position(10));
		expect(readNotePosition(storage, 'AMP.20261105.006')).toEqual(position(420));
		expect(readNotePosition(storage, 'AMP.20261105.007')).toEqual(position(10));
		expect(readNotePosition(storage, 'missing')).toBeNull();
	});

	it('replaces an older position of the same note and keeps only the most recent notes', () => {
		const storage = new MemoryStorage();
		for (let index = 0; index < MAX_REMEMBERED_NOTES + 5; index++) rememberNotePosition(storage, `note-${index}`, position(index));
		rememberNotePosition(storage, 'note-10', position(999));
		const stored = JSON.parse(storage.getItem(NOTE_POSITIONS_KEY) ?? '[]');
		expect(stored).toHaveLength(MAX_REMEMBERED_NOTES);
		expect(readNotePosition(storage, 'note-0')).toBeNull();
		expect(readNotePosition(storage, 'note-10')).toEqual(position(999));
		expect(stored.at(-1)[0]).toBe('note-10');
	});

	it('survives missing or broken storage', () => {
		expect(readNotePosition(null, 'x')).toBeNull();
		expect(() => rememberNotePosition(null, 'x', position(1))).not.toThrow();
		const storage = new MemoryStorage();
		storage.setItem(NOTE_POSITIONS_KEY, '{not json');
		expect(readNotePosition(storage, 'x')).toBeNull();
	});
});

describe('history return rule', () => {
	it('finds the note a workspace path shows', () => {
		expect(noteIdOfWorkspacePath(`/notes/${CONTRACT}/AMP.20261105.006`)).toBe('AMP.20261105.006');
		expect(noteIdOfWorkspacePath(`/notes/${CONTRACT}`)).toBeNull();
		expect(noteIdOfWorkspacePath('/')).toBeNull();
	});

	it('restores only on Back / Forward to the same note', () => {
		const tracker = createHistoryReturnTracker();
		tracker.record('link', `/notes/${CONTRACT}/AMP.20261105.006`);
		expect(tracker.isHistoryReturnTo('AMP.20261105.006')).toBe(false);
		tracker.record('goto', '/time/2026-W45');
		tracker.record('popstate', `/notes/${CONTRACT}/AMP.20261105.006`);
		expect(tracker.isHistoryReturnTo('AMP.20261105.006')).toBe(true);
		expect(tracker.isHistoryReturnTo('AMP.20261105.007')).toBe(false);
		tracker.record('goto', `/notes/${CONTRACT}/AMP.20261105.007`);
		expect(tracker.isHistoryReturnTo('AMP.20261105.007')).toBe(false);
	});

	it('a URL correction of the same note after Back keeps the return', () => {
		const tracker = createHistoryReturnTracker();
		tracker.record('popstate', `/notes/${CONTRACT}/AMP.20261105.006`);
		tracker.record('goto', `/notes/22222222-2222-4222-8222-222222222222/AMP.20261105.006`);
		expect(tracker.isHistoryReturnTo('AMP.20261105.006')).toBe(true);
	});

	it('a return from the phone capture screen (Back to the note) counts', () => {
		const tracker = createHistoryReturnTracker();
		tracker.record('goto', `/notes/${CONTRACT}/AMP.20261105.006`);
		tracker.record('goto', '/');
		tracker.record('popstate', `/notes/${CONTRACT}/AMP.20261105.006`);
		expect(tracker.isHistoryReturnTo('AMP.20261105.006')).toBe(true);
	});
});

describe('clampSelection', () => {
	it('keeps a remembered caret inside a document that has since shrunk', () => {
		expect(clampSelection({ scrollTop: 0, selectionFrom: 50, selectionTo: 80 }, 40)).toEqual({ from: 39, to: 39 });
		expect(clampSelection({ scrollTop: 0, selectionFrom: 3, selectionTo: 7 }, 40)).toEqual({ from: 3, to: 7 });
		expect(clampSelection({ scrollTop: 0, selectionFrom: null, selectionTo: null }, 40)).toBeNull();
	});
});
