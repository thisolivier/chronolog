import { describe, it, expect } from 'vitest';
import { contractInitials } from './contract-initials';

describe('contractInitials', () => {
	it('takes the first letter of each word, up to three', () => {
		expect(contractInitials('Rank Group')).toBe('RG');
		expect(contractInitials('National Debt Relief')).toBe('NDR');
		expect(contractInitials('Programme Management Office Support')).toBe('PMO');
	});

	it('uses the first two letters of a single word', () => {
		expect(contractInitials('Hungryroot')).toBe('HU');
		expect(contractInitials('easyJet')).toBe('EA');
	});

	it('keeps a short upper-case code whole', () => {
		expect(contractInitials('CCX')).toBe('CCX');
		expect(contractInitials('Q4')).toBe('Q4');
	});

	it('skips filler words and punctuation unless nothing else is left', () => {
		expect(contractInitials('Ad hoc & support')).toBe('AHS');
		expect(contractInitials('The Retainer')).toBe('RE');
		expect(contractInitials('Rank Group – Phase 2')).toBe('RGP');
		expect(contractInitials('The And')).toBe('TA');
	});

	it('keeps numbers readable', () => {
		expect(contractInitials('Phase 2')).toBe('P2');
		expect(contractInitials('2026 Retainer')).toBe('20R');
	});

	it('handles accents and empty names', () => {
		expect(contractInitials('Équipe Éditoriale')).toBe('ÉÉ');
		expect(contractInitials('')).toBe('?');
		expect(contractInitials('  — ')).toBe('?');
	});

	it('keeps combining marks with their letter (decomposed input)', () => {
		expect(contractInitials('E\u0301quipe E\u0301ditoriale')).toBe('ÉÉ');
		expect(contractInitials('Cafe\u0301 Ole\u0301')).toBe('CO');
		expect(contractInitials('a\u0308rger')).toBe('ÄR');
	});

	it('takes whole code points, not UTF-16 halves', () => {
		expect(contractInitials('𝒜lpha 𝒷eta')).toBe('𝒜𝒷'.toUpperCase());
		expect(Array.from(contractInitials('𝔄𝔅')).length).toBeLessThanOrEqual(3);
	});

	it('never grows past three letters when uppercasing (ß becomes SS)', () => {
		expect(contractInitials('ßa ßb ßc')).toBe('SSS');
		expect(contractInitials('Straße')).toBe('ST');
		expect(contractInitials('ßß')).toBe('SSS');
	});
});
