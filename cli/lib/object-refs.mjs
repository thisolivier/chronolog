/**
 * Finds one client, contract, deliverable or work type for the admin commands (sprint 031-CL),
 * archived ones included so they can be edited and restored. A reference is an id, or a path:
 * `SHORTCODE` (or client name), `SHORTCODE/Contract`, `SHORTCODE/Contract/Deliverable`,
 * `SHORTCODE/Contract/Deliverable/WorkType`. Each segment follows the contract rule in
 * `resolve.mjs`: exact match, else one partial match, else exit 3 with the candidates.
 */

import {
	isUuid,
	resolveClient,
	resolveContract,
	resolveDeliverable,
	resolveWorkType,
	splitObjectPath
} from './resolve.mjs';

export async function listClients(api, { includeArchived = true } = {}) {
	return (await api.get(`/api/clients${includeArchived ? '?includeArchived=true' : ''}`)).clients;
}

export async function listContracts(api, { includeArchived = true } = {}) {
	return (await api.get(`/api/contracts-by-client${includeArchived ? '?includeArchived=true' : ''}`)).contracts;
}

export async function listDeliverables(api, contractId, { includeArchived = true } = {}) {
	return api.get(`/api/deliverables?contractId=${contractId}${includeArchived ? '&includeArchived=true' : ''}`);
}

export async function listWorkTypes(api, deliverableId, { includeArchived = true } = {}) {
	return api.get(`/api/work-types?deliverableId=${deliverableId}${includeArchived ? '&includeArchived=true' : ''}`);
}

export async function findClient(api, reference) {
	return resolveClient(reference, await listClients(api));
}

export async function findContract(api, reference) {
	return resolveContract(reference, await listContracts(api));
}

/** The deliverable plus the contract row it belongs to (`contract`). */
export async function findDeliverable(api, reference) {
	if (isUuid(reference)) {
		const { deliverable } = await api.get(`/api/deliverables/${reference.trim()}`);
		const contract = (await listContracts(api)).find((row) => row.id === deliverable.contractId);
		return { ...deliverable, contract };
	}
	const { contractReference, deliverableName } = splitObjectPath(reference, 3, 'deliverable');
	const contract = await findContract(api, contractReference);
	const deliverable = resolveDeliverable(deliverableName, await listDeliverables(api, contract.id));
	return { ...deliverable, contract };
}

/** The work type plus its deliverable (`deliverable`, which carries `contract`). */
export async function findWorkType(api, reference) {
	if (isUuid(reference)) {
		const { workType } = await api.get(`/api/work-types/${reference.trim()}`);
		const deliverable = await findDeliverable(api, workType.deliverableId);
		return { ...workType, deliverable };
	}
	const { contractReference, deliverableName, workTypeName } = splitObjectPath(reference, 4, 'work type');
	const deliverable = await findDeliverable(api, `${contractReference}/${deliverableName}`);
	const workType = resolveWorkType(workTypeName, await listWorkTypes(api, deliverable.id));
	return { ...workType, deliverable };
}

/** `ACME/Website/Phase 1` style label for output. */
export function deliverablePath(deliverable) {
	const contract = deliverable.contract;
	return contract ? `${contract.clientShortCode}/${contract.name}/${deliverable.name}` : deliverable.name;
}

export function workTypePath(workType) {
	return `${deliverablePath(workType.deliverable)}/${workType.name}`;
}
