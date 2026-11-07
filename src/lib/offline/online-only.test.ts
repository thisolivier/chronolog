import { afterEach, describe, expect, it } from 'vitest';
import { connectivity } from '$lib/stores/connectivity.svelte';
import { HttpError } from '$lib/services/fetch-helpers';
import { NotAvailableOfflineError, runOnlineOnly } from './online-only';

describe('runOnlineOnly (timer split and resume are never queued)', () => {
	afterEach(() => connectivity.setBrowserOnline(true));

	it('runs the request online and passes its answer and its server errors through', async () => {
		expect(await runOnlineOnly('Splitting the timer', async () => 'done')).toBe('done');
		const conflict = new HttpError('not_a_draft', 409);
		await expect(runOnlineOnly('Splitting the timer', async () => Promise.reject(conflict))).rejects.toBe(conflict);
	});

	it('fails at once offline without sending anything', async () => {
		connectivity.setBrowserOnline(false);
		let sent = false;
		const attempt = runOnlineOnly('Splitting the timer', async () => {
			sent = true;
		});
		await expect(attempt).rejects.toBeInstanceOf(NotAvailableOfflineError);
		await expect(attempt).rejects.toThrow('Splitting the timer is not available offline');
		expect(sent).toBe(false);
	});

	it('turns a network failure into the same clear error', async () => {
		await expect(runOnlineOnly('Resuming the timer', async () => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow(
			'Resuming the timer is not available offline'
		);
	});
});
