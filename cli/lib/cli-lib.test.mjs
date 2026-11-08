import { describe, expect, it } from 'vitest';
import { parseArguments, UsageError } from './args.mjs';
import { resolveContract, ReferenceError_ } from './resolve.mjs';
import { readFileSync } from 'node:fs';
import { weekRange, weeksInYear, parseWeekKey, resolveDateWord, formatMinutes } from './dates.mjs';

// The app's worked examples of the week rule: the CLI's copy must agree (057-DR)
const weekFixtures = JSON.parse(readFileSync(new URL('../../src/lib/utils/iso-week.fixtures.json', import.meta.url), 'utf8'));

const contracts = [
	{ id: '11111111-1111-1111-1111-111111111111', name: 'Website rebuild', clientName: 'Acme Ltd', clientShortCode: 'ACME', isActive: true },
	{ id: '22222222-2222-2222-2222-222222222222', name: 'Retainer', clientName: 'Acme Ltd', clientShortCode: 'ACME', isActive: true },
	{ id: '33333333-3333-3333-3333-333333333333', name: 'Retainer', clientName: 'Bolt Co', clientShortCode: 'BOLT', isActive: false }
];

describe('CLI argument parsing', () => {
	it('separates positionals, valued flags and boolean flags', () => {
		expect(parseArguments(['log', 'acme', '1h', 'Did it', '--date', 'yesterday', '--json', '--note=ACME.1'])).toEqual({
			positionals: ['log', 'acme', '1h', 'Did it'],
			flags: { date: 'yesterday', json: true, note: 'ACME.1' }
		});
	});

	it('rejects a valued flag without a value', () => {
		expect(() => parseArguments(['log', '--date'])).toThrow(UsageError);
	});
});

describe('contract resolution never guesses', () => {
	it('resolves a unique partial match, an exact SHORT/name and an id', () => {
		expect(resolveContract('acme website', contracts).id).toBe(contracts[0].id);
		expect(resolveContract('ACME/Retainer', contracts).id).toBe(contracts[1].id);
		expect(resolveContract(contracts[2].id, contracts).id).toBe(contracts[2].id);
	});

	it('fails with candidates when several contracts match', () => {
		try {
			resolveContract('acme', contracts);
			throw new Error('should have thrown');
		} catch (failure) {
			expect(failure).toBeInstanceOf(ReferenceError_);
			expect(failure.code).toBe('ambiguous');
			expect(failure.candidates).toHaveLength(2);
		}
		expect(() => resolveContract('retainer', contracts)).toThrow(/matches 2 contracts/);
	});

	it('fails when nothing matches', () => {
		expect(() => resolveContract('globex', contracts)).toThrow(ReferenceError_);
	});
});

describe('CLI dates', () => {
	it('maps ISO weeks to Monday–Sunday', () => {
		expect(parseWeekKey('2026-W45')).toMatchObject({ year: 2026, weekNumber: 45 });
		expect(weekRange(2026, 45)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
		expect(weekRange(2026, 1)).toEqual({ from: '2025-12-29', to: '2026-01-04' });
		// ISO 8601 (061-DR): the boundary cases
		expect(weekRange(2026, 53)).toEqual({ from: '2026-12-28', to: '2027-01-03' });
		expect(weekRange(2027, 1)).toEqual({ from: '2027-01-04', to: '2027-01-10' });
		expect(weekRange(2025, 1)).toEqual({ from: '2024-12-30', to: '2025-01-05' });
		expect(parseWeekKey('2026-W53')).toMatchObject({ key: '2026-W53' });
		expect(parseWeekKey('2020-W53')).toMatchObject({ key: '2020-W53' });
		expect(parseWeekKey('2025-W53')).toBeNull();
		expect(parseWeekKey('2023-W53')).toBeNull();
	});

	it('resolves date words against today', () => {
		expect(resolveDateWord('today', '2026-11-03')).toBe('2026-11-03');
		expect(resolveDateWord('yesterday', '2026-11-03')).toBe('2026-11-02');
		expect(resolveDateWord('monday', '2026-11-03')).toBe('2026-11-02');
		expect(resolveDateWord('tuesday', '2026-11-03')).toBe('2026-11-03');
		expect(resolveDateWord('2026-10-30', '2026-11-03')).toBe('2026-10-30');
		expect(resolveDateWord('someday', '2026-11-03')).toBeNull();
	});

	it('formats minutes', () => {
		expect(formatMinutes(90)).toBe('1h30m');
		expect(formatMinutes(45)).toBe('45m');
		expect(formatMinutes(120)).toBe('2h');
	});
});

describe('week rule matches the app (shared fixtures)', () => {
	it.each(weekFixtures.weeks)('$date: $year-W$weekNumber starts $weekStart', ({ year, weekNumber, weekStart }) => {
		expect(weekRange(year, weekNumber).from).toBe(weekStart);
		expect(parseWeekKey(`${year}-W${weekNumber}`)).toMatchObject({ year, weekNumber });
	});

	it('counts the weeks of each year', () => {
		for (const [year, count] of Object.entries(weekFixtures.weeksInYear)) {
			expect(weeksInYear(Number(year))).toBe(count);
			expect(parseWeekKey(`${year}-W${count + 1}`)).toBeNull();
		}
	});
});
