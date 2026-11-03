import { describe, expect, it } from 'vitest';
import {
	DURATION_FORMAT_HINT,
	formatDurationInput,
	formatMinutes,
	formatMinutesCompact,
	formatTimeRange,
	parseDuration,
	validateDurationMinutes
} from './duration';

const acceptedDurationInputCases = [
	{ rawInput: '1.5', expectedDurationMinutes: 90, expectedKind: 'duration' },
	{ rawInput: '.5', expectedDurationMinutes: 30, expectedKind: 'duration' },
	{ rawInput: '1,5', expectedDurationMinutes: 90, expectedKind: 'duration' },
	{ rawInput: '1.5h', expectedDurationMinutes: 90, expectedKind: 'duration' },
	{ rawInput: '2h', expectedDurationMinutes: 120, expectedKind: 'duration' },
	{ rawInput: '2 hrs', expectedDurationMinutes: 120, expectedKind: 'duration' },
	{ rawInput: '1:30', expectedDurationMinutes: 90, expectedKind: 'duration' },
	{ rawInput: '0:45', expectedDurationMinutes: 45, expectedKind: 'duration' },
	{ rawInput: '90', expectedDurationMinutes: 90, expectedKind: 'duration' },
	{ rawInput: '90m', expectedDurationMinutes: 90, expectedKind: 'duration' },
	{ rawInput: '90 min', expectedDurationMinutes: 90, expectedKind: 'duration' },
	{ rawInput: '45 mins', expectedDurationMinutes: 45, expectedKind: 'duration' },
	{ rawInput: '2h30m', expectedDurationMinutes: 150, expectedKind: 'duration' },
	{ rawInput: '2h 30m', expectedDurationMinutes: 150, expectedKind: 'duration' },
	{ rawInput: '2h 30', expectedDurationMinutes: 150, expectedKind: 'duration' },
	{ rawInput: '2H30M', expectedDurationMinutes: 150, expectedKind: 'duration' },
	{ rawInput: '  2h 30m  ', expectedDurationMinutes: 150, expectedKind: 'duration' },
	{ rawInput: '24h', expectedDurationMinutes: 1440, expectedKind: 'duration' },
	{ rawInput: '1h  15m', expectedDurationMinutes: 75, expectedKind: 'duration' }
];

const acceptedRangeInputCases = [
	{
		rawInput: '09:00-11:15',
		expectedStartTime: '09:00:00',
		expectedEndTime: '11:15:00',
		expectedDurationMinutes: 135
	},
	{
		rawInput: '9-10:30',
		expectedStartTime: '09:00:00',
		expectedEndTime: '10:30:00',
		expectedDurationMinutes: 90
	},
	{
		rawInput: '9:00 - 17:30',
		expectedStartTime: '09:00:00',
		expectedEndTime: '17:30:00',
		expectedDurationMinutes: 510
	},
	{
		rawInput: '9:00 – 17:00',
		expectedStartTime: '09:00:00',
		expectedEndTime: '17:00:00',
		expectedDurationMinutes: 480
	},
	{
		rawInput: '00:00-23:59',
		expectedStartTime: '00:00:00',
		expectedEndTime: '23:59:00',
		expectedDurationMinutes: 1439
	},
	{
		rawInput: '9-17',
		expectedStartTime: '09:00:00',
		expectedEndTime: '17:00:00',
		expectedDurationMinutes: 480
	}
];

const rejectedInputCases = [
	{ rawInput: '' },
	{ rawInput: '   ' },
	{ rawInput: 'abc' },
	{ rawInput: '25h' },
	{ rawInput: '24h1m' },
	{ rawInput: '1441' },
	{ rawInput: '0' },
	{ rawInput: '0m' },
	{ rawInput: '0:00' },
	{ rawInput: '1:75' },
	{ rawInput: '2h75m' },
	{ rawInput: '17:00-09:00' },
	{ rawInput: '09:00-09:00' },
	{ rawInput: '25:00-26:00' },
	{ rawInput: '09:60-10:00' },
	{ rawInput: '-1h' },
	{ rawInput: '1.5.5' }
];

const longDurationWarningCases = [
	{ rawInput: '13h', expectWarning: true },
	{ rawInput: '12h', expectWarning: false },
	{ rawInput: '8:00-21:00', expectWarning: true }
];

const formatMinutesCases = [
	{ totalMinutes: 0, expectedText: '0h' },
	{ totalMinutes: 1, expectedText: '1m' },
	{ totalMinutes: 45, expectedText: '45m' },
	{ totalMinutes: 60, expectedText: '1h' },
	{ totalMinutes: 90, expectedText: '1h 30m' },
	{ totalMinutes: 135, expectedText: '2h 15m' },
	{ totalMinutes: 1440, expectedText: '24h' }
];

const formatMinutesCompactCases = [
	{ totalMinutes: 0, expectedText: '0h' },
	{ totalMinutes: 45, expectedText: '45m' },
	{ totalMinutes: 120, expectedText: '2h' },
	{ totalMinutes: 135, expectedText: '2h15' },
	{ totalMinutes: 545, expectedText: '9h05' }
];

const formatTimeRangeCases = [
	{ startTime: '09:00:00', endTime: '11:15:00', expectedText: '09:00-11:15' },
	{ startTime: '08:03:10', endTime: '08:03:50', expectedText: '08:03' },
	{ startTime: null, endTime: '10:00:00', expectedText: null },
	{ startTime: '09:00:00', endTime: null, expectedText: null }
];

const formatDurationInputCases = [
	{
		durationMinutes: 135,
		startTime: '09:00:00',
		endTime: '11:15:00',
		expectedText: '09:00-11:15'
	},
	{ durationMinutes: 1, startTime: '08:03:00', endTime: '08:03:00', expectedText: '1m' },
	{ durationMinutes: 150, startTime: null, endTime: null, expectedText: '2h30m' }
];

describe('parseDuration accepted duration inputs', () => {
	it.each(acceptedDurationInputCases)(
		'parses "$rawInput" as $expectedDurationMinutes minutes',
		({ rawInput, expectedDurationMinutes, expectedKind }) => {
			const parseResult = parseDuration(rawInput);

			expect(parseResult.ok).toBe(true);
			if (!parseResult.ok) return;
			expect(parseResult.kind).toBe(expectedKind);
			expect(parseResult.durationMinutes).toBe(expectedDurationMinutes);
		}
	);
});

describe('parseDuration accepted range inputs', () => {
	it.each(acceptedRangeInputCases)(
		'parses range "$rawInput" as $expectedStartTime to $expectedEndTime',
		({ rawInput, expectedStartTime, expectedEndTime, expectedDurationMinutes }) => {
			const parseResult = parseDuration(rawInput);

			expect(parseResult.ok).toBe(true);
			if (!parseResult.ok) return;
			expect(parseResult.kind).toBe('range');
			if (parseResult.kind !== 'range') return;
			expect(parseResult.startTime).toBe(expectedStartTime);
			expect(parseResult.endTime).toBe(expectedEndTime);
			expect(parseResult.durationMinutes).toBe(expectedDurationMinutes);
		}
	);
});

describe('parseDuration rejected inputs', () => {
	it.each(rejectedInputCases)('rejects "$rawInput" with a non-empty error', ({ rawInput }) => {
		const parseResult = parseDuration(rawInput);

		expect(parseResult.ok).toBe(false);
		if (parseResult.ok) return;
		expect(typeof parseResult.error).toBe('string');
		expect(parseResult.error.length).toBeGreaterThan(0);
	});

	it('explains the 24 hour limit when a duration is too long', () => {
		const parseResult = parseDuration('25h');

		expect(parseResult.ok).toBe(false);
		if (parseResult.ok) return;
		expect(parseResult.error).toContain('24 hours');
	});

	it('returns the format hint for unparseable text', () => {
		const parseResult = parseDuration('abc');

		expect(parseResult.ok).toBe(false);
		if (parseResult.ok) return;
		expect(parseResult.error).toBe(DURATION_FORMAT_HINT);
	});

	it('explains that the end time must be after the start time', () => {
		const parseResult = parseDuration('17:00-09:00');

		expect(parseResult.ok).toBe(false);
		if (parseResult.ok) return;
		expect(parseResult.error).toContain('after');
	});
});

describe('parseDuration long duration warnings', () => {
	it.each(longDurationWarningCases)(
		'warning present for "$rawInput" is $expectWarning',
		({ rawInput, expectWarning }) => {
			const parseResult = parseDuration(rawInput);

			expect(parseResult.ok).toBe(true);
			if (!parseResult.ok) return;
			if (expectWarning) {
				expect(parseResult.warning).toBeDefined();
				expect(typeof parseResult.warning).toBe('string');
			} else {
				expect(parseResult.warning).toBeUndefined();
			}
		}
	);
});

describe('formatMinutes', () => {
	it.each(formatMinutesCases)(
		'formats $totalMinutes minutes as "$expectedText"',
		({ totalMinutes, expectedText }) => {
			expect(formatMinutes(totalMinutes)).toBe(expectedText);
		}
	);
});

describe('formatMinutesCompact', () => {
	it.each(formatMinutesCompactCases)(
		'formats $totalMinutes minutes compactly as "$expectedText"',
		({ totalMinutes, expectedText }) => {
			expect(formatMinutesCompact(totalMinutes)).toBe(expectedText);
		}
	);
});

describe('formatTimeRange', () => {
	it.each(formatTimeRangeCases)(
		'formats start "$startTime" and end "$endTime" as $expectedText',
		({ startTime, endTime, expectedText }) => {
			expect(formatTimeRange(startTime, endTime)).toBe(expectedText);
		}
	);
});

describe('formatDurationInput', () => {
	it.each(formatDurationInputCases)(
		'pre-fills $durationMinutes minutes (start $startTime, end $endTime) as "$expectedText"',
		({ durationMinutes, startTime, endTime, expectedText }) => {
			expect(formatDurationInput(durationMinutes, startTime, endTime)).toBe(expectedText);
		}
	);
});

describe('validateDurationMinutes', () => {
	it.each([
		{ candidateValue: 1, expectedValid: true },
		{ candidateValue: 1440, expectedValid: true },
		{ candidateValue: 0, expectedValid: false },
		{ candidateValue: 1441, expectedValid: false },
		{ candidateValue: 1.5, expectedValid: false },
		{ candidateValue: '90', expectedValid: false }
	])('$candidateValue valid: $expectedValid', ({ candidateValue, expectedValid }) => {
		expect(validateDurationMinutes(candidateValue) === null).toBe(expectedValid);
	});
});
