/**
 * Sidebar sections (sprint 033-CL): the contract list from `GET /api/contracts-by-client?includeArchived=true`
 * split into the active clients and one Archived section.
 *
 * - A contract is archived when it is archived itself or its client is.
 * - Active section: clients with at least one non-archived contract, grouped and ordered as before.
 * - Archived section: archived clients with their contracts, and the archived contracts of active
 *   clients under their client's name, ordered the same way.
 * A group with exactly one contract is drawn as a single row by the sidebar; archived contracts never
 * count towards an active client's one, because they sit in the other section.
 */
import { groupContractsByClient, type ClientGroup, type GroupableContract } from './group-contracts-by-client';

export interface SectionableContract extends GroupableContract {
	archived?: boolean;
	clientArchived?: boolean;
}

export interface SidebarSections<Contract extends SectionableContract> {
	activeGroups: ClientGroup<Contract>[];
	archivedGroups: ClientGroup<Contract>[];
	/** Number of archived contracts (the rows the Archived section lists) */
	archivedContractCount: number;
	archivedContractIds: Set<string>;
}

export function isArchivedContract(contract: SectionableContract): boolean {
	return Boolean(contract.archived || contract.clientArchived);
}

export function buildSidebarSections<Contract extends SectionableContract>(
	contracts: Contract[]
): SidebarSections<Contract> {
	const activeContracts: Contract[] = [];
	const archivedContracts: Contract[] = [];
	for (const contract of contracts) {
		(isArchivedContract(contract) ? archivedContracts : activeContracts).push(contract);
	}
	return {
		activeGroups: groupContractsByClient(activeContracts),
		archivedGroups: groupContractsByClient(archivedContracts),
		archivedContractCount: archivedContracts.length,
		archivedContractIds: new Set(archivedContracts.map((contract) => contract.id))
	};
}
