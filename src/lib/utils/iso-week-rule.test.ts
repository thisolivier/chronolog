import { describe, it, expect } from 'vitest';
import {
	isoWeekOf,
	isoWeekKey,
	isoWeekNumber,
	mondayOfIsoWeek,
	parseIsoWeekKey,
	isoWeeksInYear,
	mondayOnOrBefore,
	shiftWeek
} from './iso-week';
import fixtures from './iso-week.fixtures.json';

describe('shared fixtures (also checked against the CLI copy in cli/lib/cli-lib.test.mjs)', () => {
	it.each(fixtures.weeks)('$date is $year-W$weekNumber', ({ date, year, weekNumber, weekStart }) => {
		expect(isoWeekOf(date)).toEqual({ year, weekNumber, weekStart });
		expect(mondayOfIsoWeek(year, weekNumber)).toBe(weekStart);
	});

	it('counts the weeks of each year', () => {
		for (const [year, count] of Object.entries(fixtures.weeksInYear)) expect(isoWeeksInYear(Number(year))).toBe(count);
	});
});

/** ISO 8601 (decision 2026-11-07, sprint 061-DR): week 1 contains the year's first Thursday */
describe('isoWeekOf: the year-boundary examples', () => {
	it('28 Dec 2026 – 3 Jan 2027 is 2026-W53 (its Thursday is 31 Dec 2026)', () => {
		expect(isoWeekKey('2026-12-28')).toBe('2026-W53');
		expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
		expect(isoWeekKey('2027-01-03')).toBe('2026-W53');
	});

	it('4 Jan 2027 starts 2027-W01', () => {
		expect(isoWeekOf('2027-01-04')).toEqual({ year: 2027, weekNumber: 1, weekStart: '2027-01-04' });
	});

	it('a week that starts in December can be week 1 of the next year', () => {
		expect(isoWeekKey('2025-12-29')).toBe('2026-W01');
		expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
	});

	it('1 January on a Friday to Sunday belongs to the previous year', () => {
		expect(isoWeekKey('2021-01-01')).toBe('2020-W53');
		expect(isoWeekKey('2028-01-01')).toBe('2027-W52');
		expect(isoWeekKey('2034-01-01')).toBe('2033-W52');
	});

	it('the week numbers of today', () => {
		expect(isoWeekNumber('2026-11-07')).toBe(45);
		expect(isoWeekNumber('2026-12-27')).toBe(52);
	});
});

describe('isoWeeksInYear and mondayOfIsoWeek', () => {
	it('knows which years have 53 weeks', () => {
		expect(isoWeeksInYear(2026)).toBe(53);
		expect(isoWeeksInYear(2020)).toBe(53);
		expect(isoWeeksInYear(2025)).toBe(52);
		expect(isoWeeksInYear(2027)).toBe(52);
	});

	it('round-trips every week of 2020–2034', () => {
		for (let year = 2020; year <= 2034; year++) {
			for (let weekNumber = 1; weekNumber <= isoWeeksInYear(year); weekNumber++) {
				const monday = mondayOfIsoWeek(year, weekNumber)!;
				expect(isoWeekOf(monday)).toEqual({ year, weekNumber, weekStart: monday });
				expect(isoWeekOf(shiftWeek(monday, 1)).weekStart).toBe(shiftWeek(monday, 1));
			}
		}
	});

	it('rejects weeks that do not exist', () => {
		expect(mondayOfIsoWeek(2025, 53)).toBeNull();
		expect(mondayOfIsoWeek(2026, 0)).toBeNull();
		expect(mondayOfIsoWeek(2026, 53)).toBe('2026-12-28');
		expect(mondayOfIsoWeek(2020, 53)).toBe('2020-12-28');
	});
});

describe('parseIsoWeekKey', () => {
	it('parses canonical and loose spellings; null for weeks that do not exist', () => {
		expect(parseIsoWeekKey('2026-W45')).toEqual({ year: 2026, weekNumber: 45, weekStart: '2026-11-02', key: '2026-W45' });
		expect(parseIsoWeekKey('2027w1')).toMatchObject({ key: '2027-W01', weekStart: '2027-01-04' });
		expect(parseIsoWeekKey('2026-W53')).toMatchObject({ weekStart: '2026-12-28' });
		expect(parseIsoWeekKey('2025-W53')).toBeNull();
		expect(parseIsoWeekKey('2026-11-02')).toBeNull();
	});
});

describe('shiftWeek and mondayOnOrBefore', () => {
	it('steps by whole weeks across the year boundary', () => {
		expect(shiftWeek('2026-12-21', 1)).toBe('2026-12-28');
		expect(shiftWeek('2026-12-28', -1)).toBe('2026-12-21');
		expect(mondayOnOrBefore('2027-01-03')).toBe('2026-12-28');
		expect(mondayOnOrBefore('2026-11-02')).toBe('2026-11-02');
	});

	it('is not shifted by daylight-saving changes', () => {
		expect(isoWeekOf('2026-03-29')).toMatchObject({ weekStart: '2026-03-23' });
		expect(isoWeekOf('2026-10-25')).toMatchObject({ weekStart: '2026-10-19' });
	});
});
