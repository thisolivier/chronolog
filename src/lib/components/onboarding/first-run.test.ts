import { describe, expect, it } from 'vitest';
import { hasNoOwnClients } from './first-run';

describe('hasNoOwnClients', () => {
	it('is true for a fresh account (only Internal / INTL) and for no clients at all', () => {
		expect(hasNoOwnClients([{ name: 'Internal', shortCode: 'INTL' }])).toBe(true);
		expect(hasNoOwnClients([])).toBe(true);
	});

	it('is false once any other client exists, or the starter one was renamed', () => {
		expect(hasNoOwnClients([{ name: 'Internal', shortCode: 'INTL' }, { name: 'Acme', shortCode: 'ACME' }])).toBe(false);
		expect(hasNoOwnClients([{ name: 'My company', shortCode: 'INTL' }])).toBe(false);
	});
});
