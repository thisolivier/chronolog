import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	fetchJson,
	postJson,
	putJson,
	deleteRequest,
	_resetLastLoadedResponses
} from './fetch-helpers';
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

	describe('after a successful write (QA 2, R2)', () => {
		const respondWith = (body: unknown) =>
			vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(body))));
		const goOffline = () =>
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		it('populates the cache from a GET', async () => {
			respondWith({ note: { id: 'B', content: 'v1' } });
			await fetchJson('/api/notes/B');
			goOffline();
			expect(await fetchJson('/api/notes/B')).toEqual({ note: { id: 'B', content: 'v1' } });
		});

		it('replaces the cached GET with a PUT response of the same shape', async () => {
			respondWith({ note: { id: 'B', content: 'v1' } });
			await fetchJson('/api/notes/B');
			respondWith({ note: { id: 'B', content: 'v2' } });
			await putJson('/api/notes/B', { content: 'v2' });
			goOffline();
			expect(await fetchJson('/api/notes/B')).toEqual({ note: { id: 'B', content: 'v2' } });
		});

		it('evicts the cached GET when a PUT response has a different shape', async () => {
			respondWith({ entry: { id: 'E', hours: 1 } });
			await fetchJson('/api/time-entries/E');
			respondWith({ success: true });
			await putJson('/api/time-entries/E', { hours: 2 });
			goOffline();
			await expect(fetchJson('/api/time-entries/E')).rejects.toThrow('Failed to fetch');
		});

		it('evicts the cached GET on PATCH', async () => {
			respondWith({ note: { id: 'B', content: 'v1' } });
			await fetchJson('/api/notes/B');
			respondWith({ ok: true });
			await fetchJson('/api/notes/B', { method: 'PATCH', body: '{}' });
			goOffline();
			await expect(fetchJson('/api/notes/B')).rejects.toThrow('Failed to fetch');
		});

		it('evicts the resource and its sub-resources on DELETE', async () => {
			respondWith({ note: { id: 'B' } });
			await fetchJson('/api/notes/B');
			respondWith({ backlinks: [] });
			await fetchJson('/api/notes/B/backlinks');
			respondWith({ success: true });
			await deleteRequest('/api/notes/B');
			goOffline();
			await expect(fetchJson('/api/notes/B')).rejects.toThrow('Failed to fetch');
			await expect(fetchJson('/api/notes/B/backlinks')).rejects.toThrow('Failed to fetch');
		});

		it('evicts cached reads of a collection on a POST to it, whatever their query string', async () => {
			respondWith({ notes: [] });
			await fetchJson('/api/notes?contractId=C');
			respondWith({ note: { id: 'N' } });
			await postJson('/api/notes', { contractId: 'C' });
			goOffline();
			await expect(fetchJson('/api/notes?contractId=C')).rejects.toThrow('Failed to fetch');
		});

		it('leaves cached reads of other paths untouched', async () => {
			respondWith({ note: { id: 'A', content: 'a' } });
			await fetchJson('/api/notes/A');
			respondWith({ clients: [1] });
			await fetchJson('/api/clients');
			respondWith({ note: { id: 'AB', content: 'ab' } });
			await fetchJson('/api/notes/AB');
			respondWith({ notes: [{ id: 'B' }] });
			await fetchJson('/api/notes?contractId=C');
			respondWith({ backlinks: [] });
			await fetchJson('/api/notes/B/backlinks');
			respondWith({ note: { id: 'B', content: 'v2' } });
			await putJson('/api/notes/B', { content: 'v2' });
			respondWith({ success: true });
			await deleteRequest('/api/notes/B');
			goOffline();
			expect(await fetchJson('/api/notes/A')).toEqual({ note: { id: 'A', content: 'a' } });
			expect(await fetchJson('/api/clients')).toEqual({ clients: [1] });
			expect(await fetchJson('/api/notes/AB')).toEqual({ note: { id: 'AB', content: 'ab' } });
			// The parent collection is another path: the note list stays readable offline
			expect(await fetchJson('/api/notes?contractId=C')).toEqual({ notes: [{ id: 'B' }] });
		});

		it('keeps sub-resources cached after a PUT', async () => {
			respondWith({ backlinks: [{ id: 'A' }] });
			await fetchJson('/api/notes/B/backlinks');
			respondWith({ note: { id: 'B', content: 'v2' } });
			await putJson('/api/notes/B', { content: 'v2' });
			goOffline();
			expect(await fetchJson('/api/notes/B/backlinks')).toEqual({ backlinks: [{ id: 'A' }] });
		});

		it('keeps the cache as it was when the write fails', async () => {
			respondWith({ note: { id: 'B', content: 'v1' } });
			await fetchJson('/api/notes/B');
			vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"error":"conflict"}', { status: 409 })));
			await expect(putJson('/api/notes/B', { content: 'v2' })).rejects.toThrow('409');
			goOffline();
			expect(await fetchJson('/api/notes/B')).toEqual({ note: { id: 'B', content: 'v1' } });
		});
	});
});
