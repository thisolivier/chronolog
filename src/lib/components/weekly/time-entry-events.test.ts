// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
	TIME_ENTRY_SAVED_EVENT,
	dispatchTimeEntrySaved,
	readTimeEntrySavedDetail,
	type TimeEntrySavedDetail
} from './time-entry-events';

describe('time-entry-saved window event', () => {
	it('delivers entryId and date to a window listener', () => {
		const received: TimeEntrySavedDetail[] = [];
		const listener = (event: Event) => received.push(readTimeEntrySavedDetail(event));
		window.addEventListener(TIME_ENTRY_SAVED_EVENT, listener);

		dispatchTimeEntrySaved({ entryId: 'entry-1', date: '2026-11-03' });

		window.removeEventListener(TIME_ENTRY_SAVED_EVENT, listener);
		expect(received).toEqual([{ entryId: 'entry-1', date: '2026-11-03' }]);
	});

	it('normalises a missing payload to nulls', () => {
		const received: TimeEntrySavedDetail[] = [];
		const listener = (event: Event) => received.push(readTimeEntrySavedDetail(event));
		window.addEventListener(TIME_ENTRY_SAVED_EVENT, listener);

		dispatchTimeEntrySaved();
		window.dispatchEvent(new Event(TIME_ENTRY_SAVED_EVENT));

		window.removeEventListener(TIME_ENTRY_SAVED_EVENT, listener);
		expect(received).toEqual([
			{ entryId: null, date: null },
			{ entryId: null, date: null }
		]);
	});

	it('does not reach listeners after they are removed', () => {
		let callCount = 0;
		const listener = () => (callCount += 1);
		window.addEventListener(TIME_ENTRY_SAVED_EVENT, listener);
		window.removeEventListener(TIME_ENTRY_SAVED_EVENT, listener);

		dispatchTimeEntrySaved({ entryId: 'entry-2' });

		expect(callCount).toBe(0);
	});
});
