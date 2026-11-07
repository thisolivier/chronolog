import { describe, it, expect } from 'vitest';
import {
	draftEndMoment,
	draftStartMoment,
	localMomentText,
	nextDate,
	parseExpectedMoment,
	parseLocalMoment,
	sameMoment,
	splitBoundaryProblem,
	stoppedStartProblem
} from './timer-moments';

const at = (date: string, time: string) => ({ date, time });

describe('parseLocalMoment', () => {
	it('reads YYYY-MM-DDTHH:MM[:SS] and fills the seconds', () => {
		expect(parseLocalMoment('2026-11-07T09:50')).toEqual(at('2026-11-07', '09:50:00'));
		expect(parseLocalMoment('2026-11-07T09:50:12')).toEqual(at('2026-11-07', '09:50:12'));
	});
	it('refuses zones, bad dates and other shapes', () => {
		for (const value of ['2026-11-07T09:50Z', '2026-02-30T09:00', '2026-11-07 09:50', '09:50', 'T09:50', 42, null]) {
			expect(parseLocalMoment(value)).toBeNull();
		}
	});
	it('parseExpectedMoment keeps the precision sent', () => {
		expect(parseExpectedMoment('2026-11-07T09:00')).toEqual(at('2026-11-07', '09:00'));
		expect(parseExpectedMoment('2026-11-07T09:00:37')).toEqual(at('2026-11-07', '09:00:37'));
		expect(parseExpectedMoment('2026-11-07T9:00')).toBeNull();
	});
		it('round-trips and compares at second precision', () => {
		expect(localMomentText(at('2026-11-07', '09:50'))).toBe('2026-11-07T09:50:00');
		expect(sameMoment(at('2026-11-07', '09:50'), at('2026-11-07', '09:50:00'))).toBe(true);
		expect(sameMoment(at('2026-11-07', '09:50'), at('2026-11-07', '09:50:01'))).toBe(false);
	});
});

describe('draft moments', () => {
	it('dates the end on the next day when it is before the start (midnight)', () => {
		expect(draftEndMoment({ date: '2026-11-07', startTime: '23:30:00', endTime: '00:40:00' })).toEqual(at('2026-11-08', '00:40:00'));
		expect(draftEndMoment({ date: '2026-11-07', startTime: '09:00:00', endTime: '10:00:00' })).toEqual(at('2026-11-07', '10:00:00'));
		expect(draftEndMoment({ date: '2026-11-07', startTime: '09:00:00', endTime: null })).toBeNull();
		expect(draftStartMoment({ date: '2026-11-07', startTime: '09:00', endTime: null })).toEqual(at('2026-11-07', '09:00:00'));
		expect(nextDate('2026-12-31')).toBe('2027-01-01');
	});
});

describe('splitBoundaryProblem', () => {
	const start = at('2026-11-07', '09:00:00');
	const now = at('2026-11-07', '11:00:00');

	it('accepts a boundary strictly inside a running timer (start..now)', () => {
		expect(splitBoundaryProblem({ start, end: null, now, boundary: at('2026-11-07', '09:50:00') })).toBeNull();
	});
	it('refuses a boundary at or before the start (no zero or negative left part)', () => {
		expect(splitBoundaryProblem({ start, end: null, now, boundary: start })?.code).toBe('boundary_outside');
		expect(splitBoundaryProblem({ start, end: null, now, boundary: at('2026-11-07', '08:59:59') })?.code).toBe('boundary_outside');
	});
	it('refuses a boundary after now, beyond the clock-skew slack', () => {
		expect(splitBoundaryProblem({ start, end: null, now, boundary: at('2026-11-07', '11:01:00') })).toBeNull();
		expect(splitBoundaryProblem({ start, end: null, now, boundary: at('2026-11-07', '11:02:00') })?.code).toBe('boundary_outside');
	});
	it('refuses a boundary at or after a stopped timer end (no zero right part)', () => {
		const end = at('2026-11-07', '10:00:00');
		expect(splitBoundaryProblem({ start, end, now, boundary: at('2026-11-07', '09:59:59') })).toBeNull();
		expect(splitBoundaryProblem({ start, end, now, boundary: end })?.code).toBe('boundary_outside');
	});
	it('splits across midnight', () => {
		const lateStart = at('2026-11-07', '23:00:00');
		const end = at('2026-11-08', '01:00:00');
		expect(splitBoundaryProblem({ start: lateStart, end, now, boundary: at('2026-11-08', '00:15:00') })).toBeNull();
		expect(splitBoundaryProblem({ start: lateStart, end, now, boundary: at('2026-11-07', '00:15:00') })?.code).toBe('boundary_outside');
	});
	it('refuses parts of a day or more', () => {
		const longAgo = at('2026-11-05', '09:00:00');
		expect(splitBoundaryProblem({ start: longAgo, end: null, now, boundary: at('2026-11-06', '10:00:00') })?.code).toBe('interval_too_long');
		expect(splitBoundaryProblem({ start: longAgo, end: null, now, boundary: at('2026-11-06', '08:00:00') })?.code).toBe('interval_too_long');
	});
});

describe('stoppedStartProblem', () => {
	const end = at('2026-11-07', '10:00:00');
	it('allows a start before the end, less than a day earlier', () => {
		expect(stoppedStartProblem(at('2026-11-07', '08:00:00'), end)).toBeNull();
		expect(stoppedStartProblem(at('2026-11-06', '23:00:00'), end)).toBeNull();
	});
	it('refuses a start at or after the end, or a day or more before it', () => {
		expect(stoppedStartProblem(end, end)?.code).toBe('invalid_start');
		expect(stoppedStartProblem(at('2026-11-07', '10:30:00'), end)?.code).toBe('invalid_start');
		expect(stoppedStartProblem(at('2026-11-06', '10:00:00'), end)?.code).toBe('interval_too_long');
	});
});
