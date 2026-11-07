import { describe, expect, it } from 'vitest';
import { isWholeClockText, parseClockText } from './clock-text';

describe('parseClockText', () => {
	it('reads 24-hour clocks in the usual typed forms', () => {
		expect(parseClockText('13:46')).toBe('13:46');
		expect(parseClockText(' 9:05 ')).toBe('09:05');
		expect(parseClockText('9.05')).toBe('09:05');
		expect(parseClockText('0905')).toBe('09:05');
		expect(parseClockText('905')).toBe('09:05');
		expect(parseClockText('9')).toBe('09:00');
		expect(parseClockText('00:00')).toBe('00:00');
		expect(parseClockText('23:59')).toBe('23:59');
	});

	it('refuses what is not a time of day', () => {
		for (const text of ['', '24:00', '12:60', '1:5', 'noon', '12:30 PM', '123456']) {
			expect(parseClockText(text)).toBeNull();
		}
	});
});

describe('isWholeClockText', () => {
	it('is true only for a complete HH:MM', () => {
		expect(isWholeClockText('13:46')).toBe(true);
		expect(isWholeClockText('3:46')).toBe(false);
		expect(isWholeClockText('13:4')).toBe(false);
		expect(isWholeClockText('25:00')).toBe(false);
	});
});
