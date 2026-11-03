import { describe, expect, it } from 'vitest';
import { checkWeekKey, checkWeekStatus, checkYearAndWeek } from './week-input';

describe('weekly-status input', () => {
	it('accepts years 2000–2100 and weeks 1–53, as numbers or digit strings', () => {
		expect(checkYearAndWeek(2026, 45)).toEqual({ ok: true, value: { year: 2026, weekNumber: 45 } });
		expect(checkYearAndWeek('2000', '1')).toEqual({ ok: true, value: { year: 2000, weekNumber: 1 } });
		expect(checkYearAndWeek(2100, 53).ok).toBe(true);
	});

	it.each([
		[1999, 10],
		[2101, 10],
		[26, 10],
		['20x6', 10],
		[2026.5, 10],
		[2026, 0],
		[2026, 54],
		[2026, 'abc'],
		[null, 1]
	])('rejects year %j week %j', (year, weekNumber) => {
		const result = checkYearAndWeek(year, weekNumber);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe('invalid_week');
	});

	it('parses week keys and rejects malformed ones', () => {
		expect(checkWeekKey('2026-W45')).toEqual({ ok: true, value: { year: 2026, weekNumber: 45 } });
		expect(checkWeekKey('2026-45').ok).toBe(false);
		expect(checkWeekKey('1900-W01').ok).toBe(false);
		expect(checkWeekKey('2026-W60').ok).toBe(false);
	});

	it('requires a non-empty known status, trimming whitespace', () => {
		expect(checkWeekStatus(' Submitted ')).toEqual({ ok: true, value: 'Submitted' });
		expect(checkWeekStatus('')).toMatchObject({ ok: false, error: 'status must be a non-empty string' });
		expect(checkWeekStatus('   ')).toMatchObject({ ok: false, code: 'invalid_status' });
		expect(checkWeekStatus(3)).toMatchObject({ ok: false, code: 'invalid_status' });
		expect(checkWeekStatus('Approved')).toMatchObject({ ok: false, code: 'invalid_status' });
	});
});
