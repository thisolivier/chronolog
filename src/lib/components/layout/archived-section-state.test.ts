import { describe, expect, it } from 'vitest';
import { ARCHIVED_EXPANDED_STORAGE_KEY, readArchivedExpanded, writeArchivedExpanded } from './archived-section-state';

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
		setItem: (key, value) => void values.set(key, value)
	};
}

const throwingStorage = {
	getItem: () => {
		throw new Error('SecurityError');
	},
	setItem: () => {
		throw new Error('QuotaExceededError');
	}
} as unknown as Storage;

describe('archived section preference', () => {
	it('is collapsed by default', () => {
		expect(readArchivedExpanded(memoryStorage())).toBe(false);
		expect(readArchivedExpanded(null)).toBe(false);
	});

	it('remembers the expanded state', () => {
		const storage = memoryStorage();
		writeArchivedExpanded(storage, true);
		expect(storage.getItem(ARCHIVED_EXPANDED_STORAGE_KEY)).toBe('true');
		expect(readArchivedExpanded(storage)).toBe(true);
		writeArchivedExpanded(storage, false);
		expect(readArchivedExpanded(storage)).toBe(false);
	});

	it('falls back to collapsed when storage throws', () => {
		expect(readArchivedExpanded(throwingStorage)).toBe(false);
		expect(() => writeArchivedExpanded(throwingStorage, true)).not.toThrow();
	});
});
