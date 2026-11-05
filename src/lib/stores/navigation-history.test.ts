/**
 * Tests for the in-app history mirror in navigation-history.ts (sprint 027-CL).
 */
import { describe, it, expect } from 'vitest';
import { InAppHistory, type HistorySnapshot } from './navigation-history';

/** In-memory stand-in for sessionStorage with just the two methods the store uses */
function createMemoryStorage(): Storage {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, String(value));
		}
	} as unknown as Storage;
}

function createThrowingStorage(): Pick<Storage, 'setItem'> {
	return {
		setItem: () => {
			throw new DOMException('quota exceeded', 'QuotaExceededError');
		}
	};
}

function historyWith(entries: string[], index: number): InAppHistory {
	return new InAppHistory({ entries, index });
}

describe('InAppHistory.reset', () => {
	it('starts a stack with one entry at index 0', () => {
		const history = new InAppHistory();
		history.reset('/time/2026-W45');
		expect(history.entries).toEqual(['/time/2026-W45']);
		expect(history.index).toBe(0);
		expect(history.current).toBe('/time/2026-W45');
	});

	it('discards an existing stack', () => {
		const history = historyWith(['/a', '/b', '/c'], 2);
		history.reset('/z');
		expect(history.entries).toEqual(['/z']);
		expect(history.index).toBe(0);
	});
});

describe('InAppHistory.previous', () => {
	it.each([
		{ description: 'an empty stack', entries: [], index: -1, expected: null },
		{ description: 'the first entry', entries: ['/a', '/b'], index: 0, expected: null },
		{ description: 'the second entry', entries: ['/a', '/b'], index: 1, expected: '/a' },
		{ description: 'the third entry', entries: ['/a', '/b', '/c'], index: 2, expected: '/b' }
	])('is $expected at $description', ({ entries, index, expected }) => {
		expect(historyWith(entries, index).previous).toBe(expected);
	});
});

describe('InAppHistory.apply push', () => {
	it('appends to an empty stack', () => {
		const history = new InAppHistory();
		history.apply({ kind: 'push', path: '/a' });
		expect(history.entries).toEqual(['/a']);
		expect(history.index).toBe(0);
	});

	it('appends after the current entry', () => {
		const history = new InAppHistory();
		history.reset('/a');
		history.apply({ kind: 'push', path: '/b' });
		expect(history.entries).toEqual(['/a', '/b']);
		expect(history.index).toBe(1);
		expect(history.previous).toBe('/a');
	});

	it('drops forward entries after going back, then appends', () => {
		const history = historyWith(['/a', '/b', '/c'], 2);
		history.apply({ kind: 'pop', path: '/b', delta: -1 });
		history.apply({ kind: 'pop', path: '/a', delta: -1 });
		expect(history.index).toBe(0);
		history.apply({ kind: 'push', path: '/d' });
		expect(history.entries).toEqual(['/a', '/d']);
		expect(history.index).toBe(1);
	});

	it('keeps at most 200 entries, dropping the oldest', () => {
		const history = new InAppHistory();
		for (let pathNumber = 0; pathNumber < 205; pathNumber++) {
			history.apply({ kind: 'push', path: `/page/${pathNumber}` });
		}
		expect(history.entries).toHaveLength(200);
		expect(history.entries[0]).toBe('/page/5');
		expect(history.current).toBe('/page/204');
		expect(history.index).toBe(199);
	});
});

describe('InAppHistory.apply replace', () => {
	it.each([
		{ description: 'the current entry of a multi-entry stack', entries: ['/a', '/b'], index: 1, expectedEntries: ['/a', '/x'], expectedIndex: 1 },
		{ description: 'the only entry', entries: ['/a'], index: 0, expectedEntries: ['/x'], expectedIndex: 0 }
	])('overwrites $description', ({ entries, index, expectedEntries, expectedIndex }) => {
		const history = historyWith(entries, index);
		history.apply({ kind: 'replace', path: '/x' });
		expect(history.entries).toEqual(expectedEntries);
		expect(history.index).toBe(expectedIndex);
	});

	it('resets to the path when the stack is empty', () => {
		const history = new InAppHistory();
		history.apply({ kind: 'replace', path: '/x' });
		expect(history.entries).toEqual(['/x']);
		expect(history.index).toBe(0);
	});
});

describe('InAppHistory.apply pop', () => {
	it.each([
		{
			description: 'Back (delta -1) onto a matching earlier entry',
			entries: ['/a', '/b'],
			index: 1,
			step: { kind: 'pop' as const, path: '/a', delta: -1 },
			expectedIndex: 0
		},
		{
			description: 'Forward (delta +1) onto a matching later entry',
			entries: ['/a', '/b'],
			index: 0,
			step: { kind: 'pop' as const, path: '/b', delta: 1 },
			expectedIndex: 1
		}
	])('moves the index for $description', ({ entries, index, step, expectedIndex }) => {
		const history = historyWith(entries, index);
		history.apply(step);
		expect(history.index).toBe(expectedIndex);
		expect(history.entries).toEqual(entries);
	});

	it('resets to the single path when it does not match the record', () => {
		const history = historyWith(['/a', '/b'], 1);
		history.apply({ kind: 'pop', path: '/unknown', delta: -1 });
		expect(history.entries).toEqual(['/unknown']);
		expect(history.index).toBe(0);
	});

	it('resets when Back goes past the first recorded entry', () => {
		const history = historyWith(['/a', '/b'], 0);
		history.apply({ kind: 'pop', path: '/older', delta: -1 });
		expect(history.entries).toEqual(['/older']);
		expect(history.index).toBe(0);
		expect(history.previous).toBeNull();
	});

	it('resets when Forward goes past the last recorded entry', () => {
		const history = historyWith(['/a', '/b'], 1);
		history.apply({ kind: 'pop', path: '/newer', delta: 1 });
		expect(history.entries).toEqual(['/newer']);
		expect(history.index).toBe(0);
	});
});

describe('InAppHistory snapshot', () => {
	it('returns a copy that does not alias the live stack', () => {
		const history = historyWith(['/a', '/b'], 1);
		const snapshot = history.snapshot();
		history.apply({ kind: 'push', path: '/c' });
		expect(snapshot).toEqual({ entries: ['/a', '/b'], index: 1 });
	});
});

describe('InAppHistory.restore', () => {
	it('returns null when there is no storage', () => {
		expect(InAppHistory.restore(null, '/a')).toBeNull();
	});

	it('returns null when nothing has been saved', () => {
		expect(InAppHistory.restore(createMemoryStorage(), '/a')).toBeNull();
	});

	it('returns null for garbage JSON', () => {
		const storage = createMemoryStorage();
		storage.setItem('chronolog:in-app-history', '{not json');
		expect(InAppHistory.restore(storage, '/a')).toBeNull();
	});

	it.each([
		{ description: 'entries is not an array', raw: '{"entries":"/a","index":0}' },
		{ description: 'index is not a number', raw: '{"entries":["/a"],"index":"0"}' }
	])('returns null when $description', ({ raw }) => {
		const storage = createMemoryStorage();
		storage.setItem('chronolog:in-app-history', raw);
		expect(InAppHistory.restore(storage, '/a')).toBeNull();
	});

	it('returns null when the saved current entry is not the current path', () => {
		const storage = createMemoryStorage();
		const saved: HistorySnapshot = { entries: ['/a', '/b'], index: 1 };
		storage.setItem('chronolog:in-app-history', JSON.stringify(saved));
		expect(InAppHistory.restore(storage, '/a')).toBeNull();
	});

	it('restores a snapshot whose current entry matches the path', () => {
		const storage = createMemoryStorage();
		const saved: HistorySnapshot = { entries: ['/a', '/b'], index: 1 };
		storage.setItem('chronolog:in-app-history', JSON.stringify(saved));
		const restored = InAppHistory.restore(storage, '/b');
		expect(restored).not.toBeNull();
		expect(restored?.entries).toEqual(['/a', '/b']);
		expect(restored?.index).toBe(1);
		expect(restored?.previous).toBe('/a');
	});
});

describe('InAppHistory.save', () => {
	it('round-trips through restore', () => {
		const storage = createMemoryStorage();
		const history = historyWith(['/a', '/b', '/c'], 2);
		history.save(storage);
		const restored = InAppHistory.restore(storage, '/c');
		expect(restored?.snapshot()).toEqual({ entries: ['/a', '/b', '/c'], index: 2 });
	});

	it('does nothing when there is no storage', () => {
		const history = historyWith(['/a'], 0);
		expect(() => history.save(null)).not.toThrow();
	});

	it('swallows a throwing setItem (private mode or quota)', () => {
		const history = historyWith(['/a'], 0);
		expect(() => history.save(createThrowingStorage())).not.toThrow();
	});
});

describe('InAppHistory forward (sprint 050-UI)', () => {
	it('knows nothing is ahead after a push, and nothing behind at the first entry', () => {
		const history = new InAppHistory();
		history.reset('/');
		expect(history.canGoBack).toBe(false);
		expect(history.canGoForward).toBe(false);
		history.apply({ kind: 'push', path: '/time/2026-W45' });
		expect(history.canGoBack).toBe(true);
		expect(history.next).toBeNull();
		expect(history.canGoForward).toBe(false);
	});

	it('after Back the entry left is next, and Forward returns to it', () => {
		const history = historyWith(['/', '/time/2026-W45', '/time/2026-W44'], 2);
		history.apply({ kind: 'pop', path: '/time/2026-W45', delta: -1 });
		expect(history.next).toBe('/time/2026-W44');
		expect(history.previous).toBe('/');
		expect(history.canGoForward).toBe(true);
		history.apply({ kind: 'pop', path: '/time/2026-W44', delta: 1 });
		expect(history.index).toBe(2);
		expect(history.canGoForward).toBe(false);
	});

	it('a push after Back drops what was ahead, like the browser', () => {
		const history = historyWith(['/', '/a', '/b'], 1);
		history.apply({ kind: 'push', path: '/c' });
		expect(history.entries).toEqual(['/', '/a', '/c']);
		expect(history.canGoForward).toBe(false);
	});

	it('a replace keeps what is ahead', () => {
		const history = historyWith(['/', '/a', '/b'], 1);
		history.apply({ kind: 'replace', path: '/a2' });
		expect(history.next).toBe('/b');
	});

	it('a reload restores the entries ahead too', () => {
		const storage = createMemoryStorage();
		historyWith(['/', '/a', '/b'], 1).save(storage);
		const restored = InAppHistory.restore(storage, '/a');
		expect(restored?.next).toBe('/b');
		expect(restored?.previous).toBe('/');
	});

	it('an empty history has neither', () => {
		const history = new InAppHistory();
		expect(history.next).toBeNull();
		expect(history.canGoBack).toBe(false);
		expect(history.canGoForward).toBe(false);
	});
});

describe('InAppHistory quick presses (sprint 050-UI)', () => {
	it('counts moves still on their way, so Back stops at the first entry', () => {
		const history = historyWith(['/', '/a', '/b'], 2);
		history.expectMove(-1);
		history.expectMove(-1);
		expect(history.canGoBack).toBe(false);
		expect(history.next).toBe('/a');
	});

	it('lands on where the pending moves lead when only the last move is reported', () => {
		const history = historyWith(['/', '/a', '/b', '/c'], 0);
		history.expectMove(1);
		history.expectMove(1);
		history.expectMove(1);
		history.apply({ kind: 'pop', path: '/c', delta: 1 });
		expect(history.index).toBe(3);
		expect(history.pendingMoves).toBe(0);
	});

	it('keeps the rest pending when an earlier move lands first', () => {
		const history = historyWith(['/', '/a', '/b'], 2);
		history.expectMove(-1);
		history.expectMove(-1);
		history.apply({ kind: 'pop', path: '/a', delta: -1 });
		expect(history.index).toBe(1);
		expect(history.pendingMoves).toBe(-1);
	});

	it('finds the nearest matching entry when the reported delta is short', () => {
		const history = historyWith(['/', '/a', '/b', '/c'], 0);
		history.apply({ kind: 'pop', path: '/c', delta: 1 });
		expect(history.index).toBe(3);
		expect(history.entries).toHaveLength(4);
	});

	it('a push clears pending moves', () => {
		const history = historyWith(['/', '/a'], 1);
		history.expectMove(-1);
		history.apply({ kind: 'push', path: '/z' });
		expect(history.pendingMoves).toBe(0);
		expect(history.previous).toBe('/a');
	});
});
