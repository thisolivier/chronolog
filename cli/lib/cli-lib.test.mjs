import { describe, expect, it } from 'vitest';
import { parseArguments, UsageError } from './args.mjs';
import { resolveContract, ReferenceError_ } from './resolve.mjs';
import { isoWeekRange, parseIsoWeek, resolveDateWord, formatMinutes } from './dates.mjs';

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
		expect(parseIsoWeek('2026-W45')).toMatchObject({ year: 2026, weekNumber: 45 });
		expect(isoWeekRange(2026, 45)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
		expect(isoWeekRange(2026, 1)).toEqual({ from: '2025-12-29', to: '2026-01-04' });
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
