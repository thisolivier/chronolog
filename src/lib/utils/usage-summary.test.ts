import { describe, expect, it } from 'vitest';
import { describeUsage, formatMinutes, hasRecordedWork } from './usage-summary';

describe('usage summary', () => {
	it('formats minutes as hours and minutes', () => {
		expect(formatMinutes(285)).toBe('4h 45m');
		expect(formatMinutes(60)).toBe('1h');
		expect(formatMinutes(30)).toBe('30m');
	});

	it('lists what a delete touches', () => {
		expect(describeUsage({ timeEntryCount: 3, totalMinutes: 285, noteCount: 3 })).toBe(
			'3 time entries (4h 45m) and 3 notes'
		);
		expect(describeUsage({ contractCount: 2, timeEntryCount: 1, totalMinutes: 30, noteCount: 1 })).toBe(
			'2 contracts, 1 time entry (30m) and 1 note'
		);
		expect(describeUsage({ timeEntryCount: 0, totalMinutes: 0, noteCount: 0 })).toBe('');
	});

	it('flags recorded work', () => {
		expect(hasRecordedWork({ timeEntryCount: 0, totalMinutes: 0, noteCount: 1 })).toBe(true);
		expect(hasRecordedWork({ timeEntryCount: 0, totalMinutes: 0 })).toBe(false);
	});
});
