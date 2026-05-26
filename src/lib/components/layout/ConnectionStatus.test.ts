/**
 * Tests for the ConnectionStatus component logic.
 *
 * Tests the online/offline detection and syncing state management logic
 * used by the ConnectionStatus component, without requiring a browser environment.
 */

import { describe, it, expect, vi } from 'vitest';

/**
 * Extracts and tests the core state logic of ConnectionStatus.
 * The actual Svelte component uses these same patterns with $state/$effect.
 */
function createConnectionStateManager() {
	let isOnline = true;
	let isSyncing = false;
	const timers: ReturnType<typeof setTimeout>[] = [];

	function handleOnline() {
		isOnline = true;
		isSyncing = true;
		const timer = setTimeout(() => {
			isSyncing = false;
		}, 3000);
		timers.push(timer);
	}

	function handleOffline() {
		isOnline = false;
		isSyncing = false;
	}

	function getState() {
		return { isOnline, isSyncing };
	}

	function cleanup() {
		timers.forEach(clearTimeout);
	}

	return { handleOnline, handleOffline, getState, cleanup };
}

describe('ConnectionStatus state logic', () => {
	it('starts in online state', () => {
		const manager = createConnectionStateManager();
		expect(manager.getState()).toEqual({ isOnline: true, isSyncing: false });
		manager.cleanup();
	});

	it('transitions to offline when handleOffline is called', () => {
		const manager = createConnectionStateManager();
		manager.handleOffline();
		expect(manager.getState()).toEqual({ isOnline: false, isSyncing: false });
		manager.cleanup();
	});

	it('transitions to online + syncing when handleOnline is called', () => {
		const manager = createConnectionStateManager();
		manager.handleOffline();
		manager.handleOnline();
		expect(manager.getState()).toEqual({ isOnline: true, isSyncing: true });
		manager.cleanup();
	});

	it('clears syncing state after 3 seconds', () => {
		vi.useFakeTimers();
		const manager = createConnectionStateManager();

		manager.handleOffline();
		manager.handleOnline();
		expect(manager.getState().isSyncing).toBe(true);

		vi.advanceTimersByTime(2999);
		expect(manager.getState().isSyncing).toBe(true);

		vi.advanceTimersByTime(1);
		expect(manager.getState().isSyncing).toBe(false);

		manager.cleanup();
		vi.useRealTimers();
	});

	it('resets syncing state when going offline again during sync', () => {
		vi.useFakeTimers();
		const manager = createConnectionStateManager();

		manager.handleOffline();
		manager.handleOnline();
		expect(manager.getState().isSyncing).toBe(true);

		// Go offline again before sync completes
		manager.handleOffline();
		expect(manager.getState()).toEqual({ isOnline: false, isSyncing: false });

		manager.cleanup();
		vi.useRealTimers();
	});

	it('handles rapid online/offline toggling', () => {
		vi.useFakeTimers();
		const manager = createConnectionStateManager();

		manager.handleOffline();
		manager.handleOnline();
		manager.handleOffline();
		manager.handleOnline();

		expect(manager.getState()).toEqual({ isOnline: true, isSyncing: true });

		vi.advanceTimersByTime(3000);
		expect(manager.getState().isSyncing).toBe(false);

		manager.cleanup();
		vi.useRealTimers();
	});
});
