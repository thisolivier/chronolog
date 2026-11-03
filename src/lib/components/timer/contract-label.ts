/**
 * The one contract label format used everywhere a contract is named in the
 * time-entry UI (selects, cards, timer indicator): "Client / Contract".
 */
export function formatContractLabel(clientName: string | null | undefined, contractName: string): string {
	return clientName ? `${clientName} / ${contractName}` : contractName;
}
