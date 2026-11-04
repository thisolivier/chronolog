import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesktopTimerPusher, isDesktopShell, toDesktopTimerState } from './bridge';

type FakeWindow = { __TAURI__?: { core: { invoke: ReturnType<typeof vi.fn> } } };

function installFakeTauri() {
	const invoke = vi.fn().mockResolvedValue(undefined);
	(globalThis as unknown as { window: FakeWindow }).window = { __TAURI__: { core: { invoke } } };
	return invoke;
}

afterEach(() => {
	delete (globalThis as unknown as { window?: FakeWindow }).window;
	vi.useRealTimers();
});

describe('outside the desktop shell', () => {
	it('is not a desktop shell with no window or no __TAURI__', () => {
		expect(isDesktopShell()).toBe(false);
		(globalThis as unknown as { window: FakeWindow }).window = {};
		expect(isDesktopShell()).toBe(false);
	});

	it('push and heartbeat do nothing and do not throw', () => {
		vi.useFakeTimers();
		const pusher = createDesktopTimerPusher();
		pusher.push({ running: true, startedAt: 0, contractShortCode: 'ACME' });
		const stopHeartbeat = pusher.startHeartbeat(1000);
		vi.advanceTimersByTime(5000);
		stopHeartbeat();
	});
});

describe('toDesktopTimerState', () => {
	it('anchors the start at now minus elapsed, rounded to the second', () => {
		expect(toDesktopTimerState('running', 90, 'ACME', 1_000_000_400)).toEqual({
			running: true,
			startedAt: 999_910_000,
			contractShortCode: 'ACME'
		});
	});

	it('reports not running for idle and stopped', () => {
		for (const status of ['idle', 'stopped', 'paused']) {
			expect(toDesktopTimerState(status, 300, 'ACME', 0)).toEqual({
				running: false,
				startedAt: null,
				contractShortCode: ''
			});
		}
	});
});

describe('inside the desktop shell', () => {
	let invoke: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		invoke = installFakeTauri();
	});

	it('detects the shell', () => {
		expect(isDesktopShell()).toBe(true);
	});

	it('invokes set_timer_state with running, startedAt and contractShortCode', () => {
		const pusher = createDesktopTimerPusher();
		pusher.push({ running: true, startedAt: 5000, contractShortCode: 'ACME' });
		expect(invoke).toHaveBeenCalledWith('set_timer_state', {
			running: true,
			startedAt: 5000,
			contractShortCode: 'ACME'
		});
	});

	it('skips pushes that only differ by tick jitter, and sends real changes', () => {
		const pusher = createDesktopTimerPusher();
		pusher.push(toDesktopTimerState('running', 10, '', 100_000));
		pusher.push(toDesktopTimerState('running', 11, '', 101_400)); // same start, within tolerance
		expect(invoke).toHaveBeenCalledTimes(1);
		pusher.push(toDesktopTimerState('running', 11, 'ACME', 101_400)); // contract chosen
		pusher.push(toDesktopTimerState('stopped', 0, '', 102_000)); // stopped
		pusher.push(toDesktopTimerState('running', 0, '', 500_000)); // new timer
		expect(invoke).toHaveBeenCalledTimes(4);
	});

	it('resends the last state once a minute without recomputing it', () => {
		vi.useFakeTimers();
		const pusher = createDesktopTimerPusher();
		const state = { running: true, startedAt: 42_000, contractShortCode: 'ACME' };
		pusher.push(state);
		const stopHeartbeat = pusher.startHeartbeat();
		vi.advanceTimersByTime(60_000 * 3);
		expect(invoke).toHaveBeenCalledTimes(4);
		expect(invoke).toHaveBeenLastCalledWith('set_timer_state', state);
		stopHeartbeat();
		vi.advanceTimersByTime(60_000 * 3);
		expect(invoke).toHaveBeenCalledTimes(4);
	});

	it('swallows a rejected or throwing invoke', async () => {
		invoke.mockRejectedValueOnce(new Error('denied'));
		const pusher = createDesktopTimerPusher();
		pusher.push({ running: false, startedAt: null, contractShortCode: '' });
		await Promise.resolve();
		invoke.mockImplementationOnce(() => {
			throw new Error('boom');
		});
		expect(() => pusher.push({ running: true, startedAt: 1000, contractShortCode: '' })).not.toThrow();
	});
});
