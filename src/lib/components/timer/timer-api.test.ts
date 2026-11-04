import { describe, expect, it } from 'vitest';
import { calculateElapsedFromStartTime, formatElapsedClock, secondsBetweenTimes } from './timer-api';

describe('secondsBetweenTimes', () => {
	it.each([
		{ startTime: '09:00:00', endTime: '09:00:42', expectedSeconds: 42 },
		{ startTime: '09:00', endTime: '10:30', expectedSeconds: 5400 },
		{ startTime: '23:50:00', endTime: '00:10:00', expectedSeconds: 1200 }
	])('$startTime -> $endTime = $expectedSeconds s', ({ startTime, endTime, expectedSeconds }) => {
		expect(secondsBetweenTimes(startTime, endTime)).toBe(expectedSeconds);
	});
});

describe('calculateElapsedFromStartTime', () => {
	it('counts across midnight when the start date is yesterday (23:50 -> 00:10 = 20 min)', () => {
		const now = new Date(2026, 10, 4, 0, 10, 0);
		expect(calculateElapsedFromStartTime('23:50:00', '2026-11-03', now)).toBe(1200);
	});

	it('counts whole days for a timer left running', () => {
		const now = new Date(2026, 10, 5, 9, 0, 0);
		expect(calculateElapsedFromStartTime('09:00:00', '2026-11-03', now)).toBe(2 * 24 * 3600);
	});

	it('measures a same-day start, seconds included', () => {
		const now = new Date(2026, 10, 3, 10, 30, 15);
		expect(calculateElapsedFromStartTime('09:00:05', '2026-11-03', now)).toBe(5410);
	});

	it('never goes negative for a start in the future', () => {
		const now = new Date(2026, 10, 3, 9, 0, 0);
		expect(calculateElapsedFromStartTime('09:05:00', '2026-11-03', now)).toBe(0);
	});

	it('without a date, treats a start later than now as yesterday', () => {
		const now = new Date(2026, 10, 4, 0, 10, 0);
		expect(calculateElapsedFromStartTime('23:50:00', undefined, now)).toBe(1200);
	});
});

describe('formatElapsedClock', () => {
	it.each([
		{ totalSeconds: 1, expected: '00:00:01' },
		{ totalSeconds: 59 * 60 + 59, expected: '00:59:59' },
		{ totalSeconds: 3600 + 62, expected: '01:01:02' },
		{ totalSeconds: 26 * 3600, expected: '26:00:00' }
	])('$totalSeconds s -> $expected', ({ totalSeconds, expected }) => {
		expect(formatElapsedClock(totalSeconds)).toBe(expected);
	});
});
