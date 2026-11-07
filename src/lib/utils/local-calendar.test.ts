import { describe, expect, it } from 'vitest';
import { isValidTimezone, localCalendar } from './local-calendar';

describe('local calendar', () => {
	it('uses the given timezone for today and the week', () => {
		const instant = new Date('2026-11-08T23:30:00Z'); // Sunday evening UTC, Monday in Tokyo
		expect(localCalendar(instant, 'UTC')).toMatchObject({ today: '2026-11-08', week: '2026-W45', isoWeek: '2026-W45', weekStart: '2026-11-02', weekEnd: '2026-11-08' });
		expect(localCalendar(instant, 'Asia/Tokyo')).toMatchObject({ today: '2026-11-09', week: '2026-W46', weekStart: '2026-11-09' });
	});

	it('numbers the year-boundary week by the week containing 1 January (not ISO 2026-W53)', () => {
		expect(localCalendar(new Date('2027-01-01T12:00:00Z'), 'UTC')).toMatchObject({ week: '2027-W01', weekStart: '2026-12-28', weekEnd: '2027-01-03' });
	});

	it('validates timezones', () => {
		expect(isValidTimezone('Europe/London')).toBe(true);
		expect(isValidTimezone('Mars/Base')).toBe(false);
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
