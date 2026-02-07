import { describe, it, expect } from 'vitest';
import { generateSlug } from './anchored-heading';

describe('generateSlug', () => {
	it('converts spaces to hyphens and lowercases', () => {
		expect(generateSlug('Design Review')).toBe('design-review');
	});

	it('handles hyphens and digits in mixed text', () => {
		expect(generateSlug('Phase 1 - Kickoff')).toBe('phase-1-kickoff');
	});

	it('trims leading and trailing whitespace', () => {
		expect(generateSlug('  Spaces Around  ')).toBe('spaces-around');
	});

	it('strips special characters', () => {
		expect(generateSlug('Special Ch@rs & Stuff!')).toBe('special-chrs-stuff');
	});

	it('returns empty string for empty input', () => {
		expect(generateSlug('')).toBe('');
	});

	it('lowercases already-slugged text', () => {
		expect(generateSlug('Already-Slugged')).toBe('already-slugged');
	});

	it('collapses multiple spaces into a single hyphen', () => {
		expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces');
	});
});
