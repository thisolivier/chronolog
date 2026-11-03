/**
 * Sidebar grouping (sprint 026-CL, finding 18): contracts under their client's heading.
 * Clients are ordered by name; contracts keep the order they arrive in (the server sorts them by
 * manual `sortOrder`, then name).
 */

export interface GroupableContract {
	id: string;
	clientId: string;
	clientName: string;
	clientColorIndex: number;
	clientEmoji?: string | null;
}

export interface ClientGroup<Contract extends GroupableContract> {
	clientId: string;
	clientName: string;
	clientColorIndex: number;
	clientEmoji: string | null;
	contracts: Contract[];
}

export function groupContractsByClient<Contract extends GroupableContract>(
	contracts: Contract[]
): ClientGroup<Contract>[] {
	const groups = new Map<string, ClientGroup<Contract>>();
	for (const contract of contracts) {
		let group = groups.get(contract.clientId);
		if (!group) {
			group = {
				clientId: contract.clientId,
				clientName: contract.clientName,
				clientColorIndex: contract.clientColorIndex,
				clientEmoji: contract.clientEmoji ?? null,
				contracts: []
			};
			groups.set(contract.clientId, group);
		}
		group.contracts.push(contract);
	}
	return [...groups.values()].sort((left, right) =>
		left.clientName.localeCompare(right.clientName, undefined, { sensitivity: 'base' })
	);
}
