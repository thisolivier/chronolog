import { describe, it, expect } from 'vitest';
import {
	calendarWeekOf,
	calendarWeekKey,
	mondayOfCalendarWeek,
	parseCalendarWeekKey,
	weeksInYear,
	mondayOnOrBefore,
	shiftCalendarWeek,
	legacyIsoWeekRedirect
} from './calendar-week';

/** Owner rule (decision 2026-11-07): Week 1 is the Monday-start week containing 1 January */
describe('calendarWeekOf: the worked year-boundary examples', () => {
	it('2026-12-28 (Mon) starts 2027 Week 1, because that week contains 1 Jan 2027 (ISO says 2026-W53)', () => {
		expect(calendarWeekOf('2026-12-28')).toEqual({ year: 2027, weekNumber: 1, weekStart: '2026-12-28' });
		expect(calendarWeekKey('2026-12-28')).toBe('2027-W01');
	});

	it('2027-01-01 (Fri) is in 2027 Week 1, Monday 28 Dec 2026 (ISO says 2026-W53)', () => {
		expect(calendarWeekOf('2027-01-01')).toEqual({ year: 2027, weekNumber: 1, weekStart: '2026-12-28' });
	});

	it('2027-01-04 (Mon) is 2027 Week 2 (ISO says 2027-W01)', () => {
		expect(calendarWeekOf('2027-01-04')).toEqual({ year: 2027, weekNumber: 2, weekStart: '2027-01-04' });
	});

	it('2025-12-29 (Mon) starts 2026 Week 1 (ISO agrees)', () => {
		expect(calendarWeekOf('2025-12-29')).toEqual({ year: 2026, weekNumber: 1, weekStart: '2025-12-29' });
		expect(calendarWeekOf('2026-01-04')).toEqual({ year: 2026, weekNumber: 1, weekStart: '2025-12-29' });
	});

	it('2024-12-30 (Mon) starts 2025 Week 1 (ISO agrees)', () => {
		expect(calendarWeekOf('2024-12-30')).toEqual({ year: 2025, weekNumber: 1, weekStart: '2024-12-30' });
	});

	it('the last week of 2026 is Week 52, Monday 21 Dec', () => {
		expect(calendarWeekOf('2026-12-27')).toEqual({ year: 2026, weekNumber: 52, weekStart: '2026-12-21' });
	});

	it('this week (Saturday 7 Nov 2026) is Week 45, Monday 2 Nov', () => {
		expect(calendarWeekOf('2026-11-07')).toEqual({ year: 2026, weekNumber: 45, weekStart: '2026-11-02' });
	});

	it('1 January on a Sunday: 2023 Week 1 runs 26 Dec 2022 – 1 Jan 2023', () => {
		expect(calendarWeekOf('2022-12-26')).toEqual({ year: 2023, weekNumber: 1, weekStart: '2022-12-26' });
		expect(calendarWeekOf('2023-01-02').weekNumber).toBe(2);
	});

	it('1 January on a Monday: Week 1 starts that day', () => {
		expect(calendarWeekOf('2024-01-01')).toEqual({ year: 2024, weekNumber: 1, weekStart: '2024-01-01' });
		expect(calendarWeekOf('2023-12-31')).toEqual({ year: 2023, weekNumber: 53, weekStart: '2023-12-25' });
	});
});

describe('weeksInYear and mondayOfCalendarWeek', () => {
	it('counts 52 or 53 weeks', () => {
		expect(weeksInYear(2026)).toBe(52);
		expect(weeksInYear(2027)).toBe(52);
		expect(weeksInYear(2023)).toBe(53);
	});

	it('round-trips every week of several years', () => {
		for (const year of [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028]) {
			for (let weekNumber = 1; weekNumber <= weeksInYear(year); weekNumber++) {
				const monday = mondayOfCalendarWeek(year, weekNumber)!;
				expect(calendarWeekOf(monday)).toEqual({ year, weekNumber, weekStart: monday });
			}
		}
	});

	it('refuses a week the year does not have', () => {
		expect(mondayOfCalendarWeek(2026, 53)).toBeNull();
		expect(mondayOfCalendarWeek(2026, 0)).toBeNull();
		expect(mondayOfCalendarWeek(2023, 53)).toBe('2023-12-25');
	});
});

describe('keys', () => {
	it('parses and canonicalises week keys', () => {
		expect(parseCalendarWeekKey('2026-W45')).toEqual({ year: 2026, weekNumber: 45, weekStart: '2026-11-02', key: '2026-W45' });
		expect(parseCalendarWeekKey('2027w1')).toMatchObject({ key: '2027-W01', weekStart: '2026-12-28' });
		expect(parseCalendarWeekKey('2026-W53')).toBeNull();
		expect(parseCalendarWeekKey('2026-11-02')).toBeNull();
	});

	it('redirects ISO-only legacy keys to the same Monday', () => {
		expect(legacyIsoWeekRedirect('2026-W53')).toBe('2027-W01');
		expect(legacyIsoWeekRedirect('2026-W45')).toBeNull();
		expect(legacyIsoWeekRedirect('2025-W53')).toBeNull(); // ISO 2025 has 52 weeks
	});

	it('shifts weeks across the year boundary and finds Mondays', () => {
		expect(shiftCalendarWeek('2026-12-21', 1)).toBe('2026-12-28');
		expect(shiftCalendarWeek('2026-12-28', -1)).toBe('2026-12-21');
		expect(mondayOnOrBefore('2027-01-03')).toBe('2026-12-28');
		expect(mondayOnOrBefore('2026-11-02')).toBe('2026-11-02');
	});

	it('is not moved by daylight-saving changes', () => {
		expect(calendarWeekOf('2026-03-29')).toMatchObject({ weekStart: '2026-03-23' });
		expect(calendarWeekOf('2026-10-25')).toMatchObject({ weekStart: '2026-10-19' });
	});
});
