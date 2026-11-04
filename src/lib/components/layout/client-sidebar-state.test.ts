/**
 * Sprint 039-CL: the sidebar's per-browser collapsed clients and the reorder controller (keyboard
 * moves, drop positions, announcements, revert on a failed save).
 */
import { describe, expect, it, vi } from 'vitest';
import { COLLAPSED_CLIENTS_STORAGE_KEY, readCollapsedClientIds, withClientCollapsed, writeCollapsedClientIds } from './client-collapse-state';
import { ClientReorderController, dropIndex, moveInOrder } from './client-reorder.svelte';

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

describe('collapsed clients preference', () => {
	it('is empty by default and round-trips', () => {
		const storage = memoryStorage();
		expect(readCollapsedClientIds(storage)).toEqual([]);
		writeCollapsedClientIds(storage, withClientCollapsed([], 'a', true));
		expect(readCollapsedClientIds(storage)).toEqual(['a']);
		expect(withClientCollapsed(['a', 'b'], 'a', false)).toEqual(['b']);
		expect(withClientCollapsed(['a'], 'a', true)).toEqual(['a']);
	});

	it('survives broken or throwing storage', () => {
		const storage = memoryStorage();
		storage.setItem(COLLAPSED_CLIENTS_STORAGE_KEY, '{nope');
		expect(readCollapsedClientIds(storage)).toEqual([]);
		const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('Quota'); } } as unknown as Storage;
		expect(readCollapsedClientIds(throwing)).toEqual([]);
		expect(() => writeCollapsedClientIds(throwing, ['a'])).not.toThrow();
	});
});

describe('client order helpers', () => {
	it('moves within bounds', () => {
		expect(moveInOrder(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
		expect(moveInOrder(['a', 'b', 'c'], 'c', -4)).toEqual(['c', 'a', 'b']);
		expect(moveInOrder(['a', 'b', 'c'], 'a', 9)).toEqual(['b', 'c', 'a']);
		expect(moveInOrder(['a', 'b'], 'z', 0)).toEqual(['a', 'b']);
	});

	it('drops before or after a target', () => {
		expect(dropIndex(['a', 'b', 'c'], 'a', 'c', 'after')).toBe(2);
		expect(dropIndex(['a', 'b', 'c'], 'c', 'a', 'before')).toBe(0);
		expect(dropIndex(['a', 'b', 'c'], 'a', 'b', 'before')).toBe(0);
	});
});

describe('ClientReorderController', () => {
	function controller(persist = vi.fn(async () => {})) {
		let order = ['a', 'b', 'c'];
		const revert = vi.fn();
		const reorder = new ClientReorderController({
			getOrder: () => order,
			nameOf: (id) => `Client ${id.toUpperCase()}`,
			apply: (next) => (order = next),
			persist,
			revert
		});
		return { reorder, persist, revert, order: () => order };
	}
	const key = (keyName: string, altKey = true) => ({ key: keyName, altKey, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

	it('Alt+ArrowDown / Alt+ArrowUp move, save and announce; other keys and edges do nothing', async () => {
		const { reorder, persist, order } = controller();
		expect(reorder.handleKeydown('a', key('ArrowDown'))).toBe(true);
		expect(order()).toEqual(['b', 'a', 'c']);
		expect(persist).toHaveBeenLastCalledWith(['b', 'a', 'c']);
		expect(reorder.announcement).toBe('Client A moved to position 2 of 3');
		expect(reorder.handleKeydown('a', key('ArrowDown', false))).toBe(false);
		reorder.handleKeydown('b', key('ArrowUp'));
		expect(persist).toHaveBeenCalledTimes(1);
	});

	it('reverts and says so when the save fails', async () => {
		const { reorder, revert } = controller(vi.fn(async () => Promise.reject(new Error('offline'))));
		reorder.moveTo('c', 0);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(revert).toHaveBeenCalled();
		expect(reorder.announcement).toContain('Could not save');
	});
});
