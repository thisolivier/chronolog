import { describe, it, expect } from 'vitest';
import { formatDayHeading, formatStripDay, formatWeekHeading, formatWeekSpan, neighbourWeekNumbers } from './week-labels';

describe('week labels (057-DR)', () => {
	it('spans a week in day-month order', () => {
		expect(formatWeekSpan('2026-11-02')).toBe('2–8 Nov 2026');
		expect(formatWeekSpan('2026-10-26')).toBe('26 Oct – 1 Nov 2026');
		expect(formatWeekSpan('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027');
	});

	it('numbers the heading with the Week 1 rule', () => {
		expect(formatWeekHeading('2026-11-02')).toBe('Week 45 · 2–8 Nov 2026');
		expect(formatWeekHeading('2026-12-28')).toBe('Week 1 · 28 Dec 2026 – 3 Jan 2027');
	});

	it('labels the neighbouring weeks without wrapping at 52 (the old ‹ › bug)', () => {
		expect(neighbourWeekNumbers('2026-11-02')).toEqual({ previous: 44, next: 46 });
		expect(neighbourWeekNumbers('2026-12-21')).toEqual({ previous: 51, next: 1 });
		expect(neighbourWeekNumbers('2026-12-28')).toEqual({ previous: 52, next: 2 });
		// 2023 has 53 weeks: Week 52 is followed by Week 53, not Week 1
		expect(neighbourWeekNumbers('2023-12-18')).toEqual({ previous: 51, next: 53 });
		expect(neighbourWeekNumbers('2024-01-01')).toEqual({ previous: 53, next: 2 });
	});

	it('names days', () => {
		expect(formatDayHeading('2026-11-05')).toBe('Thursday, 5 November');
		expect(formatDayHeading('2026-11-05', 'short')).toBe('Thu, 5 Nov');
		expect(formatStripDay('2026-11-02')).toBe('Mon 2');
	});
});
