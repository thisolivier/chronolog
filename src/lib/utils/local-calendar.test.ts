import { describe, expect, it } from 'vitest';
import { isValidTimezone, localCalendar, parseIsoWeekKey } from './local-calendar';

describe('local calendar', () => {
	it('uses the given timezone for today and the ISO week', () => {
		const instant = new Date('2026-11-08T23:30:00Z'); // Sunday evening UTC, Monday in Tokyo
		expect(localCalendar(instant, 'UTC')).toMatchObject({ today: '2026-11-08', isoWeek: '2026-W45', weekStart: '2026-11-02', weekEnd: '2026-11-08' });
		expect(localCalendar(instant, 'Asia/Tokyo')).toMatchObject({ today: '2026-11-09', isoWeek: '2026-W46', weekStart: '2026-11-09' });
	});

	it('handles the ISO year boundary', () => {
		expect(localCalendar(new Date('2027-01-01T12:00:00Z'), 'UTC').isoWeek).toBe('2026-W53');
	});

	it('validates timezones and week keys', () => {
		expect(isValidTimezone('Europe/London')).toBe(true);
		expect(isValidTimezone('Mars/Base')).toBe(false);
		expect(parseIsoWeekKey('2026-W05')).toEqual({ year: 2026, weekNumber: 5 });
		expect(parseIsoWeekKey('2026-W54')).toBeNull();
	});
});

describe('calendar dates and noon in a timezone (sprint 034-CL)', () => {
	it('accepts real calendar dates only', async () => {
		const { isCalendarDate } = await import('./local-calendar');
		expect(isCalendarDate('2026-11-03')).toBe(true);
		expect(isCalendarDate('2028-02-29')).toBe(true);
		for (const bad of ['2026-02-30', '2026-13-01', '3 Nov', '2026-11-3', '']) expect(isCalendarDate(bad)).toBe(false);
	});

	it('is 12:00 local time in summer, winter and far from UTC', async () => {
		const { noonInTimezone } = await import('./local-calendar');
		expect(noonInTimezone('2026-07-01', 'Europe/London').toISOString()).toBe('2026-07-01T11:00:00.000Z');
		expect(noonInTimezone('2026-11-03', 'Europe/London').toISOString()).toBe('2026-11-03T12:00:00.000Z');
		expect(noonInTimezone('2026-11-03', 'America/Los_Angeles').toISOString()).toBe('2026-11-03T20:00:00.000Z');
		expect(noonInTimezone('2026-11-03', 'Pacific/Auckland').toISOString()).toBe('2026-11-02T23:00:00.000Z');
	});
});
