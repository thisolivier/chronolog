import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '$lib/services/fetch-helpers';
import type { DataService } from '$lib/services/data-service';
import type { SplitTimerInput, SplitTimerResult, TimerEntry } from '$lib/services/types';
import { isUnsettledFailure, reconcileSplitMarker, requestFailureOf } from './split-reconcile';
import { readSplitMarker, splitMarkerFor, writeSplitMarker } from './split-marker';
import { readPendingTimer } from './pending-timer';

function request(overrides: Partial<SplitTimerInput> = {}): SplitTimerInput {
	return {
		entryId: 'draft-1',
		expectedStartedAt: '2026-11-07T09:00:00',
		expectedEndedAt: '2026-11-07T10:30:00',
		boundary: '2026-11-07T09:50:00',
		clientRequestId: 'req-1',
		left: { action: 'save', contractId: 'c1' },
		right: { contractId: null, description: 'Rest' },
		...overrides
	};
}

const timer = (startTime: string): TimerEntry => ({ id: 'draft-1', date: '2026-11-07', startTime, endTime: '10:30:00', durationMinutes: 90 });

const pendingResult: SplitTimerResult = {
	replayed: true,
	left: { action: 'discarded', date: '2026-11-07', startTime: '09:00:00', endTime: '09:50:00' },
	remainder: { kind: 'pending', date: '2026-11-07', startTime: '09:50:00', endTime: '10:30:00', description: 'Rest' }
};

function fakeService(status: TimerEntry | null, split: () => Promise<SplitTimerResult>) {
	const splitTimer = vi.fn(split);
	const service = { getTimerStatus: vi.fn(async () => ({ timer: status })), splitTimer } as unknown as DataService;
	return { service, splitTimer };
}

describe('reconciling an unsettled split (SP-08)', () => {
	beforeEach(() => {
		const storedValues = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => storedValues.get(key) ?? null,
			setItem: (key: string, value: string) => void storedValues.set(key, value),
			removeItem: (key: string) => void storedValues.delete(key)
		});
	});

	it('no marker: nothing to do', async () => {
		const { service, splitTimer } = fakeService(null, async () => pendingResult);
		expect(await reconcileSplitMarker(service, 'load')).toEqual({ kind: 'none' });
		expect(splitTimer).not.toHaveBeenCalled();
	});

	it('the draft starts at the boundary: done, no re-send', async () => {
		writeSplitMarker(splitMarkerFor(request()));
		const { service, splitTimer } = fakeService(timer('09:50:00'), async () => pendingResult);
		expect((await reconcileSplitMarker(service, 'load')).kind).toBe('split');
		expect(splitTimer).not.toHaveBeenCalled();
		expect(readSplitMarker()).toBeNull();
	});

	it('on load, an unsplit draft is split with the same request and id', async () => {
		writeSplitMarker(splitMarkerFor(request()));
		const { service, splitTimer } = fakeService(timer('09:00:00'), async () => pendingResult);
		expect((await reconcileSplitMarker(service, 'load')).kind).toBe('split');
		expect(splitTimer).toHaveBeenCalledWith(request());
		expect(readPendingTimer()).toEqual({ date: '2026-11-07', startTime: '09:50:00', description: 'Rest', endTime: '10:30:00' });
	});

	it('on Cancel, an unsplit draft is left alone and the marker forgotten', async () => {
		writeSplitMarker(splitMarkerFor(request()));
		const { service, splitTimer } = fakeService(timer('09:00:00'), async () => pendingResult);
		expect(await reconcileSplitMarker(service, 'cancel')).toEqual({ kind: 'not-split' });
		expect(splitTimer).not.toHaveBeenCalled();
		expect(readSplitMarker()).toBeNull();
	});

	it('the known gap: discard-left + contractless right answers 404 on retry; settled, the remainder restored', async () => {
		writeSplitMarker(splitMarkerFor(request({ left: { action: 'discard' } })));
		const { service } = fakeService(null, async () => {
			throw new HttpError('POST /api/timer/split failed (404): {"code":"not_found"}', 404);
		});
		expect((await reconcileSplitMarker(service, 'load')).kind).toBe('split');
		expect(readPendingTimer()).toEqual({ date: '2026-11-07', startTime: '09:50:00', description: 'Rest', endTime: '10:30:00' });
		expect(readSplitMarker()).toBeNull();
	});

	it('a 409 on re-send abandons the split and says so', async () => {
		writeSplitMarker(splitMarkerFor(request()));
		const { service } = fakeService(null, async () => {
			throw new HttpError('POST /api/timer/split failed (409): {"code":"timer_changed"}', 409);
		});
		expect((await reconcileSplitMarker(service, 'load')).kind).toBe('abandoned');
		expect(readSplitMarker()).toBeNull();
		expect(readPendingTimer()).toBeNull();
	});

	it('no connection: the marker stays for the next load', async () => {
		writeSplitMarker(splitMarkerFor(request()));
		const service = { getTimerStatus: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) } as unknown as DataService;
		expect(await reconcileSplitMarker(service, 'load')).toEqual({ kind: 'offline' });
		expect(readSplitMarker()).not.toBeNull();
	});

	it('a marker cancelled while offline never splits an unsplit draft later', async () => {
		writeSplitMarker({ ...splitMarkerFor(request()), cancelled: true });
		const { service, splitTimer } = fakeService(timer('09:00:00'), async () => pendingResult);
		expect(await reconcileSplitMarker(service, 'load')).toEqual({ kind: 'not-split' });
		expect(splitTimer).not.toHaveBeenCalled();
		expect(readSplitMarker()).toBeNull();
	});

	it('a 5xx on re-send may follow a commit: the marker stays', async () => {
		writeSplitMarker(splitMarkerFor(request()));
		const { service } = fakeService(null, async () => {
			throw new HttpError('POST /api/timer/split failed (524): timeout', 524);
		});
		expect(await reconcileSplitMarker(service, 'load')).toEqual({ kind: 'offline' });
		expect(readSplitMarker()).not.toBeNull();
	});
});

describe('which failures settle a split request', () => {
	const http = (status: number) => requestFailureOf(new HttpError(`POST /api/timer/split failed (${status}): {"code":"x"}`, status));
	it.each([500, 502, 504, 524])('%i is unsettled (the origin may have committed)', (status) => {
		expect(isUnsettledFailure(http(status))).toBe(true);
	});
	it.each([400, 404, 409])('%i is definitive', (status) => {
		expect(isUnsettledFailure(http(status))).toBe(false);
	});
	it('no answer is unsettled', () => {
		expect(isUnsettledFailure(requestFailureOf(new TypeError('Failed to fetch')))).toBe(true);
	});
});
