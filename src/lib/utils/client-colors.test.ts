import { describe, it, expect } from 'vitest';
import {
	CLIENT_COLORS,
	getClientBorderClass,
	getClientDotClass,
	getClientBgClass,
	getClientMarkTextClass,
	suggestClientColorIndex,
	findSharedClientColors
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
			expect(color.bgClass).toMatch(/^bg-id-.*-wash$/);
			expect(color.markTextClass).toMatch(/^text-/);
			expect(color.washTextClass).toMatch(/^text-id-.*-ink$/);
		}
	});
});

describe('getClientBorderClass', () => {
	it('returns correct class for index 0 (Rust)', () => {
		expect(getClientBorderClass(0)).toBe('border-l-id-rust');
	});

	it('returns correct class for index 3 (Ochre)', () => {
		expect(getClientBorderClass(3)).toBe('border-l-id-ochre');
	});

	it('wraps around for index > 7', () => {
		expect(getClientBorderClass(8)).toBe(getClientBorderClass(0));
		expect(getClientBorderClass(10)).toBe(getClientBorderClass(2));
	});
});

describe('getClientDotClass', () => {
	it('returns bg- class for each index', () => {
		expect(getClientDotClass(0)).toBe('bg-id-rust');
		expect(getClientDotClass(1)).toBe('bg-id-juniper');
	});

	it('wraps around for index > 7', () => {
		expect(getClientDotClass(9)).toBe(getClientDotClass(1));
	});
});

describe('getClientMarkTextClass', () => {
	it('uses dark ink on the light marks and light text on the dark ones', () => {
		expect(getClientMarkTextClass(3)).toBe('text-ink');
		expect(getClientMarkTextClass(4)).toBe('text-on-accent');
		expect(getClientMarkTextClass(14)).toBe(getClientMarkTextClass(6));
	});
});

describe('getClientBgClass', () => {
	it('returns the wash bg class', () => {
		expect(getClientBgClass(0)).toBe('bg-id-rust-wash');
		expect(getClientBgClass(4)).toBe('bg-id-pine-wash');
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

	it('picks the least used colour once every colour is taken (lowest index on a tie)', () => {
		expect(suggestClientColorIndex([0, 1, 2, 3, 4, 5, 6, 7, 0, 1])).toBe(2);
		expect(suggestClientColorIndex([0, 1, 2, 3, 4, 5, 6, 7])).toBe(0);
		expect(suggestClientColorIndex([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 7])).toBe(6);
	});
});

describe('findSharedClientColors', () => {
	const client = (name: string, colorIndex: number, archivedAt: Date | null = null) => ({ name, colorIndex, archivedAt });

	it('lists colours two or more active clients share, in palette order', () => {
		expect(
			findSharedClientColors([client('Acme', 1), client('Beta', 0), client('Gamma', 1), client('Delta', 0), client('Echo', 9), client('Solo', 2)])
		).toEqual([
			{ colorIndex: 0, colorName: 'Rust', clientNames: ['Beta', 'Delta'] },
			{ colorIndex: 1, colorName: 'Juniper', clientNames: ['Acme', 'Gamma', 'Echo'] }
		]);
	});

	it('ignores archived clients', () => {
		expect(findSharedClientColors([client('Acme', 1), client('Old', 1, new Date())])).toEqual([]);
	});
});
