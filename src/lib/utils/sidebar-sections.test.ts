import { describe, expect, it } from 'vitest';
import { buildSidebarSections, isArchivedContract } from './sidebar-sections';

function contract(id: string, clientName: string, flags: { archived?: boolean; clientArchived?: boolean } = {}) {
	return { id, clientId: `client-${clientName}`, clientName, clientColorIndex: 0, ...flags };
}

describe('buildSidebarSections', () => {
	it('keeps active contracts grouped by client and leaves Archived empty', () => {
		const sections = buildSidebarSections([contract('a1', 'Acme'), contract('a2', 'Acme'), contract('b1', 'Borealis')]);
		expect(sections.activeGroups.map((group) => [group.clientName, group.contracts.length])).toEqual([
			['Acme', 2],
			['Borealis', 1]
		]);
		expect(sections.archivedGroups).toEqual([]);
		expect(sections.archivedContractCount).toBe(0);
	});

	it('moves archived clients with all their contracts to Archived', () => {
		const sections = buildSidebarSections([
			contract('a1', 'Acme'),
			contract('z1', 'Zenith', { clientArchived: true }),
			contract('z2', 'Zenith', { clientArchived: true, archived: true })
		]);
		expect(sections.activeGroups.map((group) => group.clientName)).toEqual(['Acme']);
		expect(sections.archivedGroups.map((group) => [group.clientName, group.contracts.map((item) => item.id)])).toEqual([
			['Zenith', ['z1', 'z2']]
		]);
		expect(sections.archivedContractCount).toBe(2);
		expect([...sections.archivedContractIds].sort()).toEqual(['z1', 'z2']);
	});

	it('lists an archived contract of an active client under its client name in Archived', () => {
		const sections = buildSidebarSections([contract('a1', 'Acme'), contract('a2', 'Acme', { archived: true })]);
		// Acme keeps one active contract, so the sidebar draws it as a single row
		expect(sections.activeGroups).toHaveLength(1);
		expect(sections.activeGroups[0].contracts.map((item) => item.id)).toEqual(['a1']);
		expect(sections.archivedGroups[0].clientName).toBe('Acme');
		expect(sections.archivedGroups[0].contracts.map((item) => item.id)).toEqual(['a2']);
	});

	it('drops a client from the active section when all its contracts are archived', () => {
		const sections = buildSidebarSections([contract('a1', 'Acme', { archived: true })]);
		expect(sections.activeGroups).toEqual([]);
		expect(sections.archivedGroups.map((group) => group.clientName)).toEqual(['Acme']);
	});

	it('orders archived groups by client name', () => {
		const sections = buildSidebarSections([
			contract('z1', 'zeta', { clientArchived: true }),
			contract('b1', 'Beta', { archived: true })
		]);
		expect(sections.archivedGroups.map((group) => group.clientName)).toEqual(['Beta', 'zeta']);
	});
});

describe('isArchivedContract', () => {
	it('is true for an archived contract or a contract of an archived client', () => {
		expect(isArchivedContract(contract('a', 'A'))).toBe(false);
		expect(isArchivedContract(contract('a', 'A', { archived: true }))).toBe(true);
		expect(isArchivedContract(contract('a', 'A', { clientArchived: true }))).toBe(true);
	});
});
