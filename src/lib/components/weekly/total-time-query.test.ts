import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TotalTimeQuery } from './total-time-query.svelte';
import type { TotalTimeRequest, TotalTimeResult } from '$lib/services/types';

const resultFor = (totalMinutes: number): TotalTimeResult => ({ from: null, to: null, totalMinutes, entryCount: 1, contracts: [] });
const request = (contractId: string): TotalTimeRequest => ({ from: null, to: null, contracts: [contractId] });

describe('TotalTimeQuery', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('asks 200 ms after the change and shows the reply', async () => {
		const fetchTotal = vi.fn(async () => resultFor(45));
		const query = new TotalTimeQuery(fetchTotal, () => 'error');
		query.follow(() => request('a'));
		expect(query.isLoading).toBe(true);
		await vi.advanceTimersByTimeAsync(199);
		expect(fetchTotal).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(query.reply?.totalMinutes).toBe(45);
		expect(query.isLoading).toBe(false);
	});

	it('ignores a reply that a newer request overtook', async () => {
		let resolveFirst: (value: TotalTimeResult) => void = () => {};
		const fetchTotal = vi
			.fn<(request: TotalTimeRequest) => Promise<TotalTimeResult>>()
			.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
			.mockImplementationOnce(async () => resultFor(90));
		const query = new TotalTimeQuery(fetchTotal, () => 'error');
		query.follow(() => request('a'));
		await vi.advanceTimersByTimeAsync(200);
		query.follow(() => request('b'));
		await vi.advanceTimersByTimeAsync(200);
		resolveFirst(resultFor(10));
		await vi.advanceTimersByTimeAsync(0);
		expect(query.reply?.totalMinutes).toBe(90);
	});

	it('asks nothing for a null request and reports a failure without a number', async () => {
		const fetchTotal = vi.fn(async (): Promise<TotalTimeResult> => {
			throw new Error('boom');
		});
		const query = new TotalTimeQuery(fetchTotal, () => 'offline');
		query.follow(() => null);
		expect(query.isLoading).toBe(false);
		await vi.advanceTimersByTimeAsync(300);
		expect(fetchTotal).not.toHaveBeenCalled();
		query.follow(() => request('a'));
		await vi.advanceTimersByTimeAsync(200);
		expect(query.failure).toBe('offline');
		expect(query.reply).toBeNull();
	});
});
