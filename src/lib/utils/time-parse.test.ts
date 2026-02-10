import { describe, it, expect } from 'vitest';
import { parseTimeInput } from './time-parse';

describe('parseTimeInput', () => {
	describe('time range format (HH:MM-HH:MM)', () => {
		it('parses a standard time range', () => {
			const result = parseTimeInput('09:00-17:30');
			expect(result).toEqual({
				type: 'range',
				startTime: '09:00:00',
				endTime: '17:30:00',
				durationMinutes: 510
			});
		});

		it('parses a short morning range', () => {
			const result = parseTimeInput('08:00-12:00');
			expect(result).toEqual({
				type: 'range',
				startTime: '08:00:00',
				endTime: '12:00:00',
				durationMinutes: 240
			});
		});

		it('parses a range with spaces around the dash', () => {
			const result = parseTimeInput('09:00 - 17:30');
			expect(result).toEqual({
				type: 'range',
				startTime: '09:00:00',
				endTime: '17:30:00',
				durationMinutes: 510
			});
		});

		it('parses single-digit hours', () => {
			const result = parseTimeInput('9:00-17:30');
			expect(result).toEqual({
				type: 'range',
				startTime: '09:00:00',
				endTime: '17:30:00',
				durationMinutes: 510
			});
		});

		it('returns invalid when end time is before start time', () => {
			const result = parseTimeInput('17:00-09:00');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid when end time is before start with single-digit hours', () => {
			const result = parseTimeInput('9:00-5:30');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid when start and end are equal', () => {
			const result = parseTimeInput('09:00-09:00');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for hours > 23', () => {
			const result = parseTimeInput('25:00-26:00');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for minutes > 59', () => {
			const result = parseTimeInput('09:60-10:00');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('parses midnight-adjacent range', () => {
			const result = parseTimeInput('00:00-23:59');
			expect(result).toEqual({
				type: 'range',
				startTime: '00:00:00',
				endTime: '23:59:00',
				durationMinutes: 1439
			});
		});
	});

	describe('duration format - hours and minutes', () => {
		it('parses "Xh Ym" with space', () => {
			const result = parseTimeInput('2h 30m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 150 });
		});

		it('parses "XhYm" without space', () => {
			const result = parseTimeInput('2h30m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 150 });
		});

		it('parses "XhYm" with multiple spaces', () => {
			const result = parseTimeInput('1h  15m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 75 });
		});

		it('parses single-digit hours and minutes', () => {
			const result = parseTimeInput('1h 5m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 65 });
		});

		it('parses large hours', () => {
			const result = parseTimeInput('12h 45m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 765 });
		});

		it('handles case insensitivity', () => {
			const result = parseTimeInput('2H 30M');
			expect(result).toEqual({ type: 'duration', durationMinutes: 150 });
		});
	});

	describe('duration format - hours only', () => {
		it('parses "Xh"', () => {
			const result = parseTimeInput('2h');
			expect(result).toEqual({ type: 'duration', durationMinutes: 120 });
		});

		it('parses "1h"', () => {
			const result = parseTimeInput('1h');
			expect(result).toEqual({ type: 'duration', durationMinutes: 60 });
		});

		it('parses large hours', () => {
			const result = parseTimeInput('10h');
			expect(result).toEqual({ type: 'duration', durationMinutes: 600 });
		});

		it('returns invalid for 0h', () => {
			const result = parseTimeInput('0h');
			expect(result).toEqual({ type: 'invalid' });
		});
	});

	describe('duration format - minutes only', () => {
		it('parses "Ym"', () => {
			const result = parseTimeInput('30m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 30 });
		});

		it('parses large minutes', () => {
			const result = parseTimeInput('150m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 150 });
		});

		it('parses single-digit minutes', () => {
			const result = parseTimeInput('5m');
			expect(result).toEqual({ type: 'duration', durationMinutes: 5 });
		});

		it('returns invalid for 0m', () => {
			const result = parseTimeInput('0m');
			expect(result).toEqual({ type: 'invalid' });
		});
	});

	describe('invalid inputs', () => {
		it('returns invalid for empty string', () => {
			const result = parseTimeInput('');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for whitespace only', () => {
			const result = parseTimeInput('   ');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for plain number', () => {
			const result = parseTimeInput('120');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for random text', () => {
			const result = parseTimeInput('hello');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for partial time range', () => {
			const result = parseTimeInput('09:00-');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for malformed time', () => {
			const result = parseTimeInput('9:0-17:0');
			expect(result).toEqual({ type: 'invalid' });
		});

		it('returns invalid for negative duration', () => {
			const result = parseTimeInput('-2h');
			expect(result).toEqual({ type: 'invalid' });
		});
	});

	describe('whitespace handling', () => {
		it('trims leading and trailing whitespace', () => {
			const result = parseTimeInput('  2h 30m  ');
			expect(result).toEqual({ type: 'duration', durationMinutes: 150 });
		});

		it('trims whitespace on time ranges', () => {
			const result = parseTimeInput('  09:00-17:30  ');
			expect(result).toEqual({
				type: 'range',
				startTime: '09:00:00',
				endTime: '17:30:00',
				durationMinutes: 510
			});
		});
	});
});
