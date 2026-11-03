import { describe, expect, it } from 'vitest';
import { readLocalDate, readLocalTime } from './local-clock';

describe('timer local clock validation', () => {
	it.each([
		{ candidate: '2026-11-03', expected: '2026-11-03' },
		{ candidate: '2026-11-3', expected: undefined },
		{ candidate: 20261103, expected: undefined },
		{ candidate: undefined, expected: undefined }
	])('readLocalDate($candidate)', ({ candidate, expected }) => {
		expect(readLocalDate(candidate)).toBe(expected);
	});

	it.each([
		{ candidate: '23:59:59', expected: '23:59:59' },
		{ candidate: '08:03', expected: '08:03' },
		{ candidate: '24:00:00', expected: undefined },
		{ candidate: '8:03', expected: undefined },
		{ candidate: null, expected: undefined }
	])('readLocalTime($candidate)', ({ candidate, expected }) => {
		expect(readLocalTime(candidate)).toBe(expected);
	});
});
