import { describe, it, expect } from 'vitest';
import {
	getIsoWeekNumber,
	getIsoYear,
	getMondayOfIsoWeek,
	getMondayOfWeek,
	getSundayOfWeek,
	getWeekDates,
	formatDayHeader,
	formatWeekRange,
	formatHoursFromMinutes,
	formatTimeShort,
	formatDuration
} from './iso-week';

describe('getIsoWeekNumber', () => {
	it('returns week 1 for January 1, 2026 (Thursday)', () => {
		expect(getIsoWeekNumber('2026-01-01')).toBe(1);
	});

	it('returns week 6 for February 3, 2026 (Monday)', () => {
		expect(getIsoWeekNumber('2026-02-03')).toBe(6);
	});

	it('returns week 6 for February 8, 2026 (Sunday)', () => {
		expect(getIsoWeekNumber('2026-02-08')).toBe(6);
	});

	it('returns week 53 for December 28, 2020 (a year with 53 weeks)', () => {
		expect(getIsoWeekNumber('2020-12-28')).toBe(53);
	});

	it('handles year boundary — Jan 1, 2024 is in week 1 of 2024', () => {
		// Jan 1, 2024 is a Monday => ISO week 1 of 2024
		expect(getIsoWeekNumber('2024-01-01')).toBe(1);
	});
});

describe('getIsoYear', () => {
	it('returns 2026 for a date in 2026', () => {
		expect(getIsoYear('2026-02-03')).toBe(2026);
	});

	it('handles year boundary — Dec 31, 2024 belongs to ISO year 2025', () => {
		// Dec 31, 2024 is a Tuesday, week starts Dec 30 (Monday)
		// Thursday of that week is Jan 2, 2025 => ISO year 2025
		expect(getIsoYear('2024-12-31')).toBe(2025);
	});
});

describe('getMondayOfIsoWeek', () => {
	it('returns correct Monday for week 6, 2026', () => {
		expect(getMondayOfIsoWeek(2026, 6)).toBe('2026-02-02');
	});

	it('returns correct Monday for week 1, 2026', () => {
		// Week 1 of 2026: Jan 1 is Thursday, so Monday of week 1 is Dec 29, 2025
		expect(getMondayOfIsoWeek(2026, 1)).toBe('2025-12-29');
	});

	it('returns correct Monday for week 1, 2024', () => {
		// Jan 1, 2024 is Monday => that is the Monday of week 1
		expect(getMondayOfIsoWeek(2024, 1)).toBe('2024-01-01');
	});
});

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
