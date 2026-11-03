import { describe, expect, it } from 'vitest';
import { localDateString, localTimeString } from './local-date';

describe('local date helpers', () => {
	it('uses the local calendar day, not UTC', () => {
		// 23:30 local on 3 Nov is 3 Nov whatever the offset
		const lateEvening = new Date(2026, 10, 3, 23, 30, 5);
		expect(localDateString(lateEvening)).toBe('2026-11-03');
		expect(localTimeString(lateEvening)).toBe('23:30:05');
	});

	it('pads single digits', () => {
		expect(localDateString(new Date(2026, 0, 5, 7, 4, 9))).toBe('2026-01-05');
		expect(localTimeString(new Date(2026, 0, 5, 7, 4, 9))).toBe('07:04:09');
	});
});
