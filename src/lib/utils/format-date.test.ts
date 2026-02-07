import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatSmartDate } from './format-date';

describe('formatSmartDate', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return HH:mm for today', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-07T14:30:00'));

		const result = formatSmartDate('2026-02-07T10:15:00');
		expect(result).toBe('10:15');
	});

	it('should return day name for yesterday', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-07T14:30:00'));

		// Feb 6, 2026 is a Friday
		const result = formatSmartDate('2026-02-06T10:15:00');
		expect(result).toBe('Friday');
	});

	it('should return day name for 6 days ago', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-07T14:30:00'));

		// Feb 1, 2026 is a Sunday
		const result = formatSmartDate('2026-02-01T10:15:00');
		expect(result).toBe('Sunday');
	});

	it('should return DD/MM/YYYY for 7+ days ago', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-07T14:30:00'));

		// Jan 31, 2026 is exactly 7 days ago
		const result = formatSmartDate('2026-01-31T10:15:00');
		expect(result).toBe('31/01/2026');
	});

	it('should return DD/MM/YYYY for old dates', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-07T14:30:00'));

		const result = formatSmartDate('2025-06-15T10:15:00');
		expect(result).toBe('15/06/2025');
	});

	it('should handle midnight boundary correctly', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-07T00:01:00'));

		// Still today even at midnight
		const result = formatSmartDate('2026-02-07T00:00:00');
		expect(result).toBe('00:00');
	});
});
