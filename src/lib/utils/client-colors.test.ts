import { describe, it, expect } from 'vitest';
import {
	CLIENT_COLORS,
	getClientBorderClass,
	getClientDotClass,
	getClientBgClass,
	suggestClientColorIndex
} from './client-colors';

describe('CLIENT_COLORS', () => {
	it('has 8 colors', () => {
		expect(CLIENT_COLORS).toHaveLength(8);
	});

	it('each color has all required class fields', () => {
		for (const color of CLIENT_COLORS) {
			expect(color.name).toBeTruthy();
			expect(color.borderClass).toMatch(/^border-l-/);
			expect(color.dotClass).toMatch(/^bg-/);
			expect(color.bgClass).toMatch(/^bg-.*-50$/);
		}
	});
});

describe('getClientBorderClass', () => {
	it('returns correct class for index 0 (Rose)', () => {
		expect(getClientBorderClass(0)).toBe('border-l-rose-400');
	});

	it('returns correct class for index 3 (Amber)', () => {
		expect(getClientBorderClass(3)).toBe('border-l-amber-500');
	});

	it('wraps around for index > 7', () => {
		expect(getClientBorderClass(8)).toBe(getClientBorderClass(0));
		expect(getClientBorderClass(10)).toBe(getClientBorderClass(2));
	});
});

describe('getClientDotClass', () => {
	it('returns bg- class for each index', () => {
		expect(getClientDotClass(0)).toBe('bg-rose-400');
		expect(getClientDotClass(1)).toBe('bg-sky-400');
	});

	it('wraps around for index > 7', () => {
		expect(getClientDotClass(9)).toBe(getClientDotClass(1));
	});
});

describe('getClientBgClass', () => {
	it('returns -50 shade bg class', () => {
		expect(getClientBgClass(0)).toBe('bg-rose-50');
		expect(getClientBgClass(4)).toBe('bg-teal-50');
	});

	it('wraps around for index > 7', () => {
		expect(getClientBgClass(16)).toBe(getClientBgClass(0));
	});
});

describe('suggestClientColorIndex', () => {
	it('picks the first palette colour no client uses', () => {
		expect(suggestClientColorIndex([])).toBe(0);
		expect(suggestClientColorIndex([0, 1, 3])).toBe(2);
		expect(suggestClientColorIndex([8])).toBe(1);
	});

	it('wraps the client count once every colour is taken', () => {
		expect(suggestClientColorIndex([0, 1, 2, 3, 4, 5, 6, 7, 0, 1])).toBe(2);
	});
});
