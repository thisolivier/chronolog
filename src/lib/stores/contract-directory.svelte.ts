/**
 * Names of the visible contracts, filled by the sidebar when it loads them, so other parts of the
 * shell (the page `<title>`) can name the selected contract without another request.
 */
export interface ContractLabel {
	name: string;
	clientName: string;
}

class ContractDirectory {
	labels = $state<Record<string, ContractLabel>>({});

	replaceAll(contracts: Array<{ id: string; name: string; clientName: string }>): void {
		this.labels = Object.fromEntries(
			contracts.map((contract) => [contract.id, { name: contract.name, clientName: contract.clientName }])
		);
	}
}

export const contractDirectory = new ContractDirectory();
