/**
 * The user's contracts as the sidebar loaded them (`GET /api/contracts-by-client?includeArchived=true`),
 * archived ones included. Other parts of the shell (page `<title>`, panel headers, phone labels) name
 * the selected contract from `labels` without another request, archived contracts too.
 *
 * The store decides what is active (sprint 033-CL): `sections` splits the list into the active
 * clients and the Archived section (`$lib/utils/sidebar-sections.ts`).
 */
import type { ContractsByClientResult } from '$lib/services/types';
import { buildSidebarSections } from '$lib/utils/sidebar-sections';

export interface ContractLabel {
	name: string;
	clientName: string;
	clientId: string;
}

/** What `replaceAll` needs at least; the rest defaults (tests pass only names) */
export type DirectoryContractInput = Pick<ContractsByClientResult, 'id' | 'name' | 'clientName' | 'clientId'> &
	Partial<ContractsByClientResult>;

function withDefaults(contract: DirectoryContractInput): ContractsByClientResult {
	return {
		isActive: true,
		clientShortCode: '',
		clientEmoji: null,
		clientColorIndex: 0,
		noteCount: 0,
		archived: false,
		clientArchived: false,
		...contract
	};
}

class ContractDirectory {
	contracts = $state<ContractsByClientResult[]>([]);

	labels = $derived<Record<string, ContractLabel>>(
		Object.fromEntries(
			this.contracts.map((contract) => [
				contract.id,
				{ name: contract.name, clientName: contract.clientName, clientId: contract.clientId }
			])
		)
	);

	/** Active clients and the Archived section, as the sidebar draws them */
	sections = $derived(buildSidebarSections(this.contracts));

	replaceAll(contracts: DirectoryContractInput[]): void {
		this.contracts = contracts.map(withDefaults);
	}

	/** Apply a client order at once, before the server saves it (the sidebar's reorder, 039-CL) */
	applyClientOrder(orderedClientIds: string[]): void {
		const positionOf = new Map(orderedClientIds.map((clientId, index) => [clientId, index]));
		this.contracts = this.contracts.map((contract) =>
			positionOf.has(contract.clientId) ? { ...contract, clientSortOrder: positionOf.get(contract.clientId) } : contract
		);
	}

	isArchived(contractId: string | null): boolean {
		return contractId !== null && this.sections.archivedContractIds.has(contractId);
	}

	/** A client's name from any of its contracts, or null while the sidebar has not loaded it */
	clientName(clientId: string | null): string | null {
		if (!clientId) return null;
		return this.contracts.find((contract) => contract.clientId === clientId)?.clientName ?? null;
	}

	/** The client's contracts (archived ones last), for the client view's New Note (sprint 039-CL) */
	contractsOfClient(clientId: string | null): ContractsByClientResult[] {
		if (!clientId) return [];
		const ofClient = this.contracts.filter((contract) => contract.clientId === clientId);
		return [...ofClient.filter((contract) => !this.isArchived(contract.id)), ...ofClient.filter((contract) => this.isArchived(contract.id))];
	}

	/** "Acme Corp · Rocket Build", or null while the sidebar has not loaded that contract */
	contextLabel(contractId: string | null): string | null {
		const label = contractId ? this.labels[contractId] : undefined;
		return label ? `${label.clientName} · ${label.name}` : null;
	}
}

export const contractDirectory = new ContractDirectory();
