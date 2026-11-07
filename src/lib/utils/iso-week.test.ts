import { describe, it, expect } from 'vitest';
import {
	getMondayOfWeek,
	getSundayOfWeek,
	getWeekDates,
	formatDayHeader,
	formatWeekRange,
	formatHoursFromMinutes,
	formatTimeShort,
	formatDuration,
	getOrdinalSuffix,
	formatWeekStartShort,
	formatWeekStartLabel
} from './iso-week';

describe('getMondayOfWeek', () => {
	it('returns the same date if input is already Monday', () => {
		expect(getMondayOfWeek('2026-02-02')).toBe('2026-02-02');
	});

	it('returns Monday for a Wednesday input', () => {
		expect(getMondayOfWeek('2026-02-04')).toBe('2026-02-02');
	});

	it('returns Monday for a Sunday input', () => {
		expect(getMondayOfWeek('2026-02-08')).toBe('2026-02-02');
	});
});

describe('getSundayOfWeek', () => {
	it('returns Sunday 6 days after Monday', () => {
		expect(getSundayOfWeek('2026-02-02')).toBe('2026-02-08');
	});
});

describe('getWeekDates', () => {
	it('returns 7 dates starting from Monday', () => {
		const dates = getWeekDates('2026-02-02');
		expect(dates).toHaveLength(7);
		expect(dates[0]).toBe('2026-02-02');
		expect(dates[6]).toBe('2026-02-08');
	});
});

describe('formatDayHeader', () => {
	it('formats a date as weekday, month, and day', () => {
		const result = formatDayHeader('2026-02-03');
		expect(result).toContain('Tuesday');
		expect(result).toContain('Feb');
		expect(result).toContain('3');
	});
});

describe('formatWeekRange', () => {
	it('formats same-month range', () => {
		const result = formatWeekRange('2026-02-02');
		expect(result).toBe('Feb 2-8, 2026');
	});

	it('formats cross-month range', () => {
		const result = formatWeekRange('2026-01-26');
		expect(result).toBe('Jan 26 - Feb 1, 2026');
	});
});

describe('formatHoursFromMinutes', () => {
	it('formats 450 minutes as 7.5 hrs', () => {
		expect(formatHoursFromMinutes(450)).toBe('7.5 hrs');
	});

	it('formats 60 minutes as 1 hrs', () => {
		expect(formatHoursFromMinutes(60)).toBe('1 hrs');
	});

	it('formats 0 minutes as 0 hrs', () => {
		expect(formatHoursFromMinutes(0)).toBe('0 hrs');
	});
});

describe('formatTimeShort', () => {
	it('formats HH:MM:SS to HH:MM', () => {
		expect(formatTimeShort('09:30:00')).toBe('09:30');
	});

	it('returns --:-- for null', () => {
		expect(formatTimeShort(null)).toBe('--:--');
	});
});

describe('getOrdinalSuffix', () => {
	it('returns "st" for 1', () => {
		expect(getOrdinalSuffix(1)).toBe('st');
	});

	it('returns "nd" for 2', () => {
		expect(getOrdinalSuffix(2)).toBe('nd');
	});

	it('returns "rd" for 3', () => {
		expect(getOrdinalSuffix(3)).toBe('rd');
	});

	it('returns "th" for 4-10', () => {
		for (const day of [4, 5, 6, 7, 8, 9, 10]) {
			expect(getOrdinalSuffix(day)).toBe('th');
		}
	});

	it('returns "th" for 11, 12, 13 (teens)', () => {
		expect(getOrdinalSuffix(11)).toBe('th');
		expect(getOrdinalSuffix(12)).toBe('th');
		expect(getOrdinalSuffix(13)).toBe('th');
	});

	it('returns "st" for 21, "nd" for 22, "rd" for 23', () => {
		expect(getOrdinalSuffix(21)).toBe('st');
		expect(getOrdinalSuffix(22)).toBe('nd');
		expect(getOrdinalSuffix(23)).toBe('rd');
	});

	it('returns "st" for 31', () => {
		expect(getOrdinalSuffix(31)).toBe('st');
	});
});

describe('formatWeekStartShort', () => {
	it('formats Monday Feb 9 2026 correctly', () => {
		expect(formatWeekStartShort('2026-02-09')).toBe('Monday 9th Feb');
	});

	it('formats Monday Feb 2 2026 correctly', () => {
		expect(formatWeekStartShort('2026-02-02')).toBe('Monday 2nd Feb');
	});

	it('formats Monday Jan 1 2024 (week 1) correctly', () => {
		expect(formatWeekStartShort('2024-01-01')).toBe('Monday 1st Jan');
	});

	it('formats Monday Dec 23 2024 correctly', () => {
		expect(formatWeekStartShort('2024-12-23')).toBe('Monday 23rd Dec');
	});
});

describe('formatWeekStartLabel', () => {
	it('prepends "Week Starting" to short format', () => {
		expect(formatWeekStartLabel('2026-02-09')).toBe('Week Starting Monday 9th Feb');
	});
});

describe('formatDuration', () => {
	it('formats hours and minutes', () => {
		expect(formatDuration(90)).toBe('1h 30m');
	});

	it('formats hours only when no remaining minutes', () => {
		expect(formatDuration(120)).toBe('2h');
	});

	it('formats minutes only when less than an hour', () => {
		expect(formatDuration(45)).toBe('45m');
	});
});
