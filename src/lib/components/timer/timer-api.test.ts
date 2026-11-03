import { describe, expect, it } from 'vitest';
import { secondsBetweenTimes } from './timer-api';

describe('secondsBetweenTimes', () => {
	it.each([
		{ startTime: '09:00:00', endTime: '09:00:42', expectedSeconds: 42 },
		{ startTime: '09:00', endTime: '10:30', expectedSeconds: 5400 },
		{ startTime: '23:50:00', endTime: '00:10:00', expectedSeconds: 1200 }
	])('$startTime -> $endTime = $expectedSeconds s', ({ startTime, endTime, expectedSeconds }) => {
		expect(secondsBetweenTimes(startTime, endTime)).toBe(expectedSeconds);
	});
});
