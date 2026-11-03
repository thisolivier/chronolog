import { describe, expect, it } from 'vitest';
import { formatContractLabel } from './contract-label';

describe('formatContractLabel', () => {
	it('joins client and contract with a slash', () => {
		expect(formatContractLabel('Acme Corp', 'Rocket Build')).toBe('Acme Corp / Rocket Build');
	});

	it('falls back to the contract name when the client is missing', () => {
		expect(formatContractLabel('', 'Rocket Build')).toBe('Rocket Build');
		expect(formatContractLabel(undefined, 'Rocket Build')).toBe('Rocket Build');
	});
});
