import { describe, it, expect } from 'vitest';
import { calculateTimerDurationMinutes, parseTimeToSeconds } from './timer-duration';

describe('parseTimeToSeconds', () => {
	it('parses HH:MM:SS and HH:MM', () => {
		expect(parseTimeToSeconds('01:02:03')).toBe(3723);
		expect(parseTimeToSeconds('01:02')).toBe(3720);
		expect(parseTimeToSeconds('00:00:00')).toBe(0);
	});
});

describe('calculateTimerDurationMinutes', () => {
	it('rounds sub-minute timers up to 1 minute', () => {
		expect(calculateTimerDurationMinutes('10:00:00', '10:00:04')).toBe(1);
		expect(calculateTimerDurationMinutes('10:00:00', '10:00:59')).toBe(1);
		expect(calculateTimerDurationMinutes('10:00:00', '10:00:00')).toBe(1);
	});

	it('keeps exact minutes and rounds partial minutes up', () => {
		expect(calculateTimerDurationMinutes('10:00:00', '10:01:00')).toBe(1);
		expect(calculateTimerDurationMinutes('10:00:00', '10:01:01')).toBe(2);
		expect(calculateTimerDurationMinutes('09:15:00', '10:45:00')).toBe(90);
	});

	it('uses seconds, not just HH:MM (the old bug)', () => {
		// Old code: 10:00 -> 10:00 = 0 minutes. Now 10:00:30 -> 10:01:10 is 40 s -> 1 minute.
		expect(calculateTimerDurationMinutes('10:00:30', '10:01:10')).toBe(1);
		// 10:00:50 -> 10:02:05 is 75 s -> 2 minutes.
		expect(calculateTimerDurationMinutes('10:00:50', '10:02:05')).toBe(2);
	});

	it('treats an end time before the start time as crossing midnight', () => {
		expect(calculateTimerDurationMinutes('23:59:30', '00:00:30')).toBe(1);
		expect(calculateTimerDurationMinutes('23:00:00', '01:00:00')).toBe(120);
		expect(calculateTimerDurationMinutes('23:30:00', '00:15:00')).toBe(45);
	});

	it('accepts HH:MM inputs without seconds', () => {
		expect(calculateTimerDurationMinutes('09:00', '09:30')).toBe(30);
	});
});
