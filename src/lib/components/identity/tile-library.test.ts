import { describe, expect, it } from 'vitest';
import { TILE_COUNT, TILE_MOTIFS, tileIndexForContract, tileMaskStyle, tileMaskUrl, tileSvg } from './tile-library';

/** Deterministic pseudo-random UUIDs (mulberry32), so the spread test never flakes */
function sampleUuids(count: number, seed: number): string[] {
	let state = seed;
	const nextByte = () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) & 0xff;
	};
	return Array.from({ length: count }, () => {
		const hex = Array.from({ length: 16 }, () => nextByte().toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
	});
}

describe('tile library', () => {
	it('has at least 32 motifs with unique ids and distinct geometry', () => {
		expect(TILE_COUNT).toBeGreaterThanOrEqual(32);
		expect(new Set(TILE_MOTIFS.map((motif) => motif.id)).size).toBe(TILE_COUNT);
		expect(new Set(TILE_MOTIFS.map((motif) => motif.shapes)).size).toBe(TILE_COUNT);
	});

	it('draws every motif as plain shapes on a 24-unit square', () => {
		for (const motif of TILE_MOTIFS) {
			const svg = tileSvg(motif);
			expect(svg).toContain('viewBox="0 0 24 24"');
			expect(svg).toMatch(/<(rect|circle|polygon|path)\b/);
			expect(svg).not.toMatch(/stroke|<text|<image|style=/);
		}
	});

	it('builds a data-URI mask with the WebKit-prefixed properties too', () => {
		const style = tileMaskStyle(0, '16px', 'repeat-x');
		expect(style).toContain("-webkit-mask-image: url('data:image/svg+xml,");
		expect(style).toContain('mask-size: 16px 16px');
		expect(style).toContain('-webkit-mask-repeat: repeat-x');
		expect(tileMaskUrl(0)).not.toContain('"');
		expect(tileMaskUrl(TILE_COUNT)).toBe(tileMaskUrl(0));
		expect(tileMaskUrl(-1)).toBe(tileMaskUrl(TILE_COUNT - 1));
	});
});

describe('tileIndexForContract', () => {
	it('maps a fixed id to a fixed index (FNV-1a 32-bit modulo the library size)', () => {
		// FNV-1a("a") = 0xe40c292c; FNV-1a("") = the offset basis 0x811c9dc5
		expect(tileIndexForContract('a')).toBe(0xe40c292c % TILE_COUNT);
		expect(tileIndexForContract('')).toBe(0x811c9dc5 % TILE_COUNT);
		const contractId = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b';
		expect(tileIndexForContract(contractId)).toBe(tileIndexForContract(contractId));
	});

	it('stays inside the library', () => {
		for (const contractId of sampleUuids(500, 7)) {
			const index = tileIndexForContract(contractId);
			expect(Number.isInteger(index)).toBe(true);
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(TILE_COUNT);
		}
	});

	it('spreads 200 UUIDs across the library, no motif taking more than 10%', () => {
		const counts = new Map<number, number>();
		for (const contractId of sampleUuids(200, 2026)) {
			const index = tileIndexForContract(contractId);
			counts.set(index, (counts.get(index) ?? 0) + 1);
		}
		expect(Math.max(...counts.values())).toBeLessThanOrEqual(20);
		// Most of the library is in use (expected about 98% of motifs hit at least once)
		expect(counts.size).toBeGreaterThanOrEqual(Math.floor(TILE_COUNT * 0.8));
	});
});
