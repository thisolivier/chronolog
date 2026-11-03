import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutosaveController, trackNoteSave, waitForNoteSaves, type SaveStatus } from './note-autosave';

function setup(persistImpl?: (snapshot: string) => Promise<void>) {
	let content = '';
	const saved: Array<{ snapshot: string; keepalive: boolean }> = [];
	const statuses: SaveStatus[] = [];
	const persist = vi.fn(async (snapshot: string, options: { keepalive: boolean }) => {
		if (persistImpl) await persistImpl(snapshot);
		saved.push({ snapshot, keepalive: options.keepalive });
	});
	const controller = new AutosaveController<string>({
		capture: () => content,
		persist,
		onStatusChange: (status) => statuses.push(status),
		delayMs: 500,
		retryDelayMs: 1000
	});
	const type = (text: string) => {
		content += text;
		controller.markDirty();
	};
	return { controller, saved, statuses, persist, type };
}

describe('AutosaveController', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('debounces saves and reports unsaved -> saving -> saved', async () => {
		const { saved, statuses, type } = setup();
		type('a');
		type('b');
		expect(saved).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(500);
		expect(saved).toEqual([{ snapshot: 'ab', keepalive: false }]);
		expect(statuses).toEqual(['unsaved', 'saving', 'saved']);
	});

	it('flush saves immediately without waiting for the debounce', async () => {
		const { controller, saved, type } = setup();
		type('typed just now');
		await controller.flush();
		expect(saved.map((entry) => entry.snapshot)).toEqual(['typed just now']);
		await vi.advanceTimersByTimeAsync(1000);
		expect(saved).toHaveLength(1);
	});

	it('dispose captures the text synchronously and still saves it', async () => {
		const { controller, saved, type } = setup();
		type('last words');
		const disposal = controller.dispose();
		await disposal;
		expect(saved.map((entry) => entry.snapshot)).toEqual(['last words']);
	});

	it('keepalive flush starts the request in the same task', () => {
		const { controller, persist, type } = setup();
		type('unload');
		void controller.flush({ keepalive: true });
		expect(persist).toHaveBeenCalledWith('unload', { keepalive: true });
	});

	it('flush with nothing pending does not save', async () => {
		const { controller, persist } = setup();
		await controller.flush();
		expect(persist).not.toHaveBeenCalled();
	});

	it('runs saves in order', async () => {
		let release: () => void = () => {};
		let firstCall = true;
		const { controller, saved, type } = setup(
			(snapshot) =>
				new Promise<void>((resolve) => {
					if (firstCall) {
						firstCall = false;
						release = resolve;
					} else {
						resolve();
					}
					void snapshot;
				})
		);
		type('one');
		const firstSave = controller.flush();
		type(' two');
		const secondSave = controller.flush();
		await vi.advanceTimersByTimeAsync(0); // let the first persist start
		release();
		await firstSave;
		await secondSave;
		expect(saved.map((entry) => entry.snapshot)).toEqual(['one', 'one two']);
	});

	it('retries a failed save and reports error until it succeeds', async () => {
		let failuresLeft = 1;
		const { controller, saved, statuses, type } = setup(async () => {
			if (failuresLeft > 0) {
				failuresLeft -= 1;
				throw new Error('offline');
			}
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		type('important');
		await controller.flush();
		expect(statuses.at(-1)).toBe('error');
		expect(controller.hasUnsavedChanges).toBe(true);
		await vi.advanceTimersByTimeAsync(1000);
		expect(saved.map((entry) => entry.snapshot)).toEqual(['important']);
		expect(statuses.at(-1)).toBe('saved');
		expect(controller.hasUnsavedChanges).toBe(false);
	});

	it('retries a failed save after dispose with the captured snapshot', async () => {
		let failuresLeft = 1;
		const { controller, saved, type } = setup(async () => {
			if (failuresLeft > 0) {
				failuresLeft -= 1;
				throw new Error('offline');
			}
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		type('before destroy');
		await controller.dispose();
		await vi.advanceTimersByTimeAsync(1000);
		expect(saved.map((entry) => entry.snapshot)).toEqual(['before destroy']);
	});
});

describe('AutosaveController conflicts', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('stops saving on a conflict instead of retrying or overwriting', async () => {
		let content = '';
		const statuses: SaveStatus[] = [];
		const persist = vi.fn(async () => {
			throw Object.assign(new Error('409'), { status: 409 });
		});
		const controller = new AutosaveController<string>({
			capture: () => content,
			persist,
			onStatusChange: (status) => statuses.push(status),
			isConflict: (error) => (error as { status?: number }).status === 409,
			retryDelayMs: 1000
		});
		content = 'stale tab text';
		controller.markDirty();
		await controller.flush();
		expect(statuses.at(-1)).toBe('conflict');
		content += ' more typing';
		controller.markDirty();
		await controller.dispose({ keepalive: true });
		await vi.advanceTimersByTimeAsync(5000);
		expect(persist).toHaveBeenCalledTimes(1);
		expect(controller.status).toBe('conflict');
	});
});

describe('trackNoteSave / waitForNoteSaves', () => {
	it('waits for every tracked save of a note', async () => {
		let release: () => void = () => {};
		const slowSave = new Promise<void>((resolve) => (release = resolve));
		void trackNoteSave('N1', slowSave);
		let waited = false;
		const waiting = waitForNoteSaves('N1').then(() => (waited = true));
		await Promise.resolve();
		expect(waited).toBe(false);
		release();
		await waiting;
		expect(waited).toBe(true);
	});

	it('resolves immediately when nothing is pending', async () => {
		await expect(waitForNoteSaves('nothing')).resolves.toBeUndefined();
	});
});
