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
});
