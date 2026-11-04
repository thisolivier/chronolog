import { describe, it, expect } from 'vitest';
import {
	findOverlappingEntry,
	localMomentInTimezone,
	previousDate,
	timerStartProblem,
	wallClockSeconds
} from './timer-start-rules';

const now = { date: '2026-11-04', time: '15:00:00' };

describe('timerStartProblem', () => {
	it('accepts a start earlier today and one within the clock-skew slack', () => {
		expect(timerStartProblem({ date: '2026-11-04', time: '09:30:00' }, now)).toBeNull();
		expect(timerStartProblem({ date: '2026-11-04', time: '15:01:30' }, now)).toBeNull();
	});

	it('refuses a start in the future', () => {
		expect(timerStartProblem({ date: '2026-11-04', time: '15:05' }, now)?.code).toBe('start_in_future');
		expect(timerStartProblem({ date: '2026-11-05', time: '09:00' }, now)?.code).toBe('start_in_future');
	});

	it('accepts yesterday evening and refuses more than 24 hours ago', () => {
		expect(timerStartProblem({ date: '2026-11-03', time: '23:10' }, now)).toBeNull();
		expect(timerStartProblem({ date: '2026-11-03', time: '15:00' }, now)).toBeNull();
		expect(timerStartProblem({ date: '2026-11-03', time: '14:59' }, now)?.code).toBe('start_too_early');
	});
});

describe('findOverlappingEntry', () => {
	const entry = (id: string, date: string, startTime: string | null, endTime: string | null) => ({ id, date, startTime, endTime });

	it('finds an entry ending after the new start, and reports the one ending last', () => {
		const entries = [
			entry('morning', '2026-11-04', '08:00:00', '09:00:00'),
			entry('late-morning', '2026-11-04', '09:00:00', '10:30:00'),
			entry('early', '2026-11-04', '07:00:00', '08:00:00')
		];
		expect(findOverlappingEntry(entries, { date: '2026-11-04', time: '09:30' }, now)?.id).toBe('late-morning');
		expect(findOverlappingEntry(entries, { date: '2026-11-04', time: '08:30' }, now)?.id).toBe('late-morning');
	});

	it('ignores entries that end at or before the start, untimed entries and entries after now', () => {
		const entries = [
			entry('ends-at-start', '2026-11-04', '08:00:00', '09:30:00'),
			entry('untimed', '2026-11-04', null, null),
			entry('no-length', '2026-11-04', '10:00:00', '10:00:00'),
			entry('later', '2026-11-04', '16:00:00', '17:00:00')
		];
		expect(findOverlappingEntry(entries, { date: '2026-11-04', time: '09:30' }, now)).toBeNull();
	});

	it('handles an entry crossing midnight and a start on the previous day', () => {
		const lateNight = [entry('late-night', '2026-11-03', '22:00:00', '00:30:00')];
		expect(findOverlappingEntry(lateNight, { date: '2026-11-04', time: '00:15' }, now)?.id).toBe('late-night');
		expect(findOverlappingEntry(lateNight, { date: '2026-11-04', time: '00:30' }, now)).toBeNull();
		const today = [entry('today', '2026-11-04', '00:10:00', '00:40:00')];
		expect(findOverlappingEntry(today, { date: '2026-11-03', time: '23:10' }, now)?.id).toBe('today');
	});
});

describe('clock helpers', () => {
	it('reads the wall clock of an instant in a timezone', () => {
		const instant = new Date('2026-11-04T23:30:00Z');
		expect(localMomentInTimezone(instant, 'Europe/London')).toEqual({ date: '2026-11-04', time: '23:30:00' });
		expect(localMomentInTimezone(instant, 'Australia/Sydney')).toEqual({ date: '2026-11-05', time: '10:30:00' });
	});

	it('previousDate crosses months and years; wall-clock seconds order moments', () => {
		expect(previousDate('2026-03-01')).toBe('2026-02-28');
		expect(previousDate('2027-01-01')).toBe('2026-12-31');
		expect(wallClockSeconds({ date: '2026-11-04', time: '00:00' }) - wallClockSeconds({ date: '2026-11-03', time: '23:00' })).toBe(3600);
	});
});
