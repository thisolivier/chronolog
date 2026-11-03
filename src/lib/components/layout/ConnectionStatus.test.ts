/**
 * Tests for the connectivity store behind ConnectionStatus (the real module, not a copy).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectivity } from '$lib/stores/connectivity.svelte';

describe('connectivity store', () => {
	afterEach(() => {
		connectivity.setBrowserOnline(true);
		vi.useRealTimers();
	});

	it('is offline when the browser reports offline', () => {
		connectivity.setBrowserOnline(false);
		expect(connectivity.isOffline).toBe(true);
	});

	it('is offline when a request fails at the network level, even if the browser says online', () => {
		connectivity.reportNetworkFailure();
		expect(connectivity.isOffline).toBe(true);
		connectivity.reportNetworkSuccess();
		expect(connectivity.isOffline).toBe(false);
	});

	it('shows "back online" for three seconds after reconnecting', () => {
		vi.useFakeTimers();
		connectivity.setBrowserOnline(false);
		connectivity.setBrowserOnline(true);
		expect(connectivity.recentlyReconnected).toBe(true);
		vi.advanceTimersByTime(3000);
		expect(connectivity.recentlyReconnected).toBe(false);
	});

	it('going offline again cancels the reconnect notice', () => {
		connectivity.setBrowserOnline(false);
		connectivity.setBrowserOnline(true);
		connectivity.setBrowserOnline(false);
		expect(connectivity.recentlyReconnected).toBe(false);
		expect(connectivity.isOffline).toBe(true);
	});
});
