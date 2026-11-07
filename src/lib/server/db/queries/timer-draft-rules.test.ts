import { describe, it, expect } from 'vitest';
import { isSplitRemainder, momentMatches } from './timer-draft-rules';

describe('momentMatches', () => {
	const stored = { date: '2026-11-07', time: '09:00:37' };
	it('compares at minute precision when HH:MM is sent', () => {
		expect(momentMatches(stored, { date: '2026-11-07', time: '09:00' })).toBe(true);
		expect(momentMatches(stored, { date: '2026-11-07', time: '09:01' })).toBe(false);
	});
	it('compares at second precision when HH:MM:SS is sent', () => {
		expect(momentMatches(stored, { date: '2026-11-07', time: '09:00:37' })).toBe(true);
		expect(momentMatches(stored, { date: '2026-11-07', time: '09:00:00' })).toBe(false);
	});
	it('needs the same date and a stored time', () => {
		expect(momentMatches(stored, { date: '2026-11-06', time: '09:00' })).toBe(false);
		expect(momentMatches({ date: '2026-11-07', time: null }, { date: '2026-11-07', time: '09:00' })).toBe(false);
		expect(momentMatches({ date: '2026-11-07', time: '09:00' }, { date: '2026-11-07', time: '09:00:00' })).toBe(true);
	});
});

describe('isSplitRemainder', () => {
	it('spots the remainder mark only', () => {
		expect(isSplitRemainder({ clientRequestId: 'split-1:remainder' })).toBe(true);
		expect(isSplitRemainder({ clientRequestId: 'offline-abc' })).toBe(false);
		expect(isSplitRemainder({ clientRequestId: null })).toBe(false);
	});
});
