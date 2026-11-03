import { describe, expect, it } from 'vitest';
import { groupContractsByClient } from './group-contracts-by-client';

const contract = (id: string, clientId: string, clientName: string) => ({
	id,
	clientId,
	clientName,
	clientColorIndex: 1
});

describe('groupContractsByClient', () => {
	it('groups under clients ordered by name and keeps contract order within a client', () => {
		const groups = groupContractsByClient([
			contract('support', 'acme', 'Acme Corp'),
			contract('audit', 'globex', 'Globex'),
			contract('rocket', 'acme', 'Acme Corp'),
			contract('general', 'internal', 'internal')
		]);
		expect(groups.map((group) => group.clientName)).toEqual(['Acme Corp', 'Globex', 'internal']);
		expect(groups[0].contracts.map((item) => item.id)).toEqual(['support', 'rocket']);
	});

	it('returns no groups for no contracts', () => {
		expect(groupContractsByClient([])).toEqual([]);
	});
});
