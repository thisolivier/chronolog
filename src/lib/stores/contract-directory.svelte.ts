/**
 * Names of the visible contracts, filled by the sidebar when it loads them, so other parts of the
 * shell (the page `<title>`) can name the selected contract without another request.
 */
export interface ContractLabel {
	name: string;
	clientName: string;
	clientId: string;
}

class ContractDirectory {
	labels = $state<Record<string, ContractLabel>>({});

	replaceAll(contracts: Array<{ id: string; name: string; clientName: string; clientId: string }>): void {
		this.labels = Object.fromEntries(
			contracts.map((contract) => [
				contract.id,
				{ name: contract.name, clientName: contract.clientName, clientId: contract.clientId }
			])
		);
	}

	/** "Acme Corp · Rocket Build", or null while the sidebar has not loaded that contract */
	contextLabel(contractId: string | null): string | null {
		const label = contractId ? this.labels[contractId] : undefined;
		return label ? `${label.clientName} · ${label.name}` : null;
	}
}

export const contractDirectory = new ContractDirectory();
