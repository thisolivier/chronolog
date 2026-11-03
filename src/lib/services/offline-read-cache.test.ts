import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, postJson, _resetLastLoadedResponses } from './fetch-helpers';
import { connectivity } from '$lib/stores/connectivity.svelte';

describe('offline read cache in fetchJson', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		_resetLastLoadedResponses();
		connectivity.setBrowserOnline(true);
	});

	it('returns the last loaded body for a GET when the network fails, and flags offline', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ weeks: [1] }))));
		expect(await fetchJson('/api/time-entries/weekly?w=1')).toEqual({ weeks: [1] });

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
		expect(await fetchJson('/api/time-entries/weekly?w=1')).toEqual({ weeks: [1] });
		expect(connectivity.isOffline).toBe(true);
	});

	it('still throws for a GET that was never loaded', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
		await expect(fetchJson('/api/never-loaded')).rejects.toThrow('Failed to fetch');
	});

	it('never pretends a write succeeded offline', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
		await expect(postJson('/api/time-entries', {})).rejects.toThrow('Failed to fetch');
	});

	it('clears the offline flag on the next successful response', async () => {
		connectivity.reportNetworkFailure();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}')));
		await fetchJson('/api/clients');
		expect(connectivity.isOffline).toBe(false);
	});
});
