import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getClientForUser } from '$lib/server/db/queries/clients';
import { getContractForClient, updateContract } from '$lib/server/db/queries/contracts';
import {
	listDeliverablesForContract,
	createDeliverable,
	updateDeliverable,
	getDeliverable
} from '$lib/server/db/queries/deliverables';
import {
	listWorkTypesForDeliverable,
	createWorkType,
	updateWorkType,
	reorderWorkTypes
} from '$lib/server/db/queries/work-types';
import {
	deleteDeliverableWithNote,
	deleteWorkTypeWithNote,
	getEntryCountsBy
} from '$lib/server/db/queries/safe-deletion';
import { entriesKeptMessage, readUuidField, requireUser } from '$lib/server/admin-actions';

const NO_ENTRIES = { timeEntryCount: 0, totalMinutes: 0 };

/** Resolve the client and contract from the URL, scoped to the signed-in user (404 otherwise). */
async function loadOwnedContract(params: { clientId: string; contractId: string }, locals: App.Locals) {
	const currentUser = requireUser(locals);
	const client = await getClientForUser(params.clientId, currentUser.id);
	if (!client) throw error(404, 'Client not found');
	const contract = await getContractForClient(params.contractId, client.id);
	if (!contract) throw error(404, 'Contract not found');
	return { client, contract };
}

/** A deliverable ID from a form, only if that deliverable belongs to this contract. */
async function readOwnedDeliverable(formData: FormData, contractId: string) {
	const deliverableId = readUuidField(formData, 'deliverable_id');
	return deliverableId ? getDeliverable(deliverableId, contractId) : null;
}

function parseSortOrder(formData: FormData): number {
	return parseInt(formData.get('sort_order')?.toString() || '0', 10) || 0;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { client, contract } = await loadOwnedContract(params, locals);

	const deliverableList = await listDeliverablesForContract(contract.id);
	const deliverablesWithWorkTypes = await Promise.all(
		deliverableList.map(async (deliverable) => ({
			...deliverable,
			workTypes: await listWorkTypesForDeliverable(deliverable.id)
		}))
	);
	const deliverableCounts = await getEntryCountsBy('deliverableId', deliverableList.map((row) => row.id));
	const workTypeCounts = await getEntryCountsBy(
		'workTypeId',
		deliverablesWithWorkTypes.flatMap((deliverable) => deliverable.workTypes.map((workType) => workType.id))
	);

	return {
		client,
		contract,
		deliverables: deliverablesWithWorkTypes.map((deliverable) => ({
			...deliverable,
			usage: deliverableCounts.get(deliverable.id) ?? NO_ENTRIES,
			workTypes: deliverable.workTypes.map((workType) => ({
				...workType,
				usage: workTypeCounts.get(workType.id) ?? NO_ENTRIES
			}))
		}))
	};
};

export const actions: Actions = {
	updateContract: async ({ request, params, locals }) => {
		const { client, contract } = await loadOwnedContract(params, locals);

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isActive = formData.get('is_active') === 'on';

		if (!name) return fail(400, { error: 'A contract needs a name.' });

		const updatedContract = await updateContract(contract.id, client.id, { name, description, isActive });
		if (!updatedContract) return fail(404, { error: 'That contract no longer exists.' });

		return { success: true, message: `Contract “${name}” saved.` };
	},

	createDeliverable: async ({ request, params, locals }) => {
		const { contract } = await loadOwnedContract(params, locals);
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		if (!name) return fail(400, { error: 'Enter a name for the deliverable.' });

		await createDeliverable(contract.id, name, parseSortOrder(formData));
		return { success: true, message: `Deliverable “${name}” added to ${contract.name}.` };
	},

	updateDeliverable: async ({ request, params, locals }) => {
		const { contract } = await loadOwnedContract(params, locals);
		const formData = await request.formData();
		const deliverableId = readUuidField(formData, 'deliverable_id');
		const name = formData.get('name')?.toString().trim();

		if (!deliverableId) return fail(400, { error: 'That deliverable no longer exists.' });
		if (!name) return fail(400, { error: 'A deliverable needs a name.' });

		const updated = await updateDeliverable(deliverableId, contract.id, { name, sortOrder: parseSortOrder(formData) });
		if (!updated) return fail(404, { error: 'That deliverable no longer exists.' });
		return { success: true, message: `Deliverable “${name}” saved.` };
	},

	deleteDeliverable: async ({ request, params, locals }) => {
		const { contract } = await loadOwnedContract(params, locals);
		const formData = await request.formData();
		const deliverableId = readUuidField(formData, 'deliverable_id');
		if (!deliverableId) return fail(400, { error: 'That deliverable no longer exists.' });

		const deliverable = (await listDeliverablesForContract(contract.id)).find((row) => row.id === deliverableId);
		const result = await deleteDeliverableWithNote(deliverableId, contract.id);
		if (!result || !deliverable) return fail(404, { error: 'That deliverable no longer exists.' });

		return {
			success: true,
			message: `Deleted deliverable “${deliverable.name}”.${entriesKeptMessage(result.annotatedTimeEntryCount, deliverable.name)}`
		};
	},

	createWorkType: async ({ request, params, locals }) => {
		const { contract } = await loadOwnedContract(params, locals);
		const formData = await request.formData();
		const deliverable = await readOwnedDeliverable(formData, contract.id);
		const deliverableId = deliverable?.id;
		const name = formData.get('name')?.toString().trim();
		if (!deliverableId || !name) return fail(400, { error: 'Enter a name for the work type.' });

		await createWorkType(deliverableId, name, parseSortOrder(formData));
		return { success: true, message: `Work type “${name}” added.` };
	},

	updateWorkType: async ({ request, params, locals }) => {
		const { contract } = await loadOwnedContract(params, locals);
		const formData = await request.formData();
		const workTypeId = readUuidField(formData, 'work_type_id');
		const deliverable = await readOwnedDeliverable(formData, contract.id);
		const deliverableId = deliverable?.id;
		const name = formData.get('name')?.toString().trim();

		if (!workTypeId || !deliverableId) return fail(400, { error: 'That work type no longer exists.' });
		if (!name) return fail(400, { error: 'A work type needs a name.' });

		const updated = await updateWorkType(workTypeId, deliverableId, { name, sortOrder: parseSortOrder(formData) });
		if (!updated) return fail(404, { error: 'That work type no longer exists.' });
		return { success: true, message: `Work type “${name}” saved.` };
	},

	deleteWorkType: async ({ request, params, locals }) => {
		const { contract } = await loadOwnedContract(params, locals);
		const formData = await request.formData();
		const workTypeId = readUuidField(formData, 'work_type_id');
		const deliverable = await readOwnedDeliverable(formData, contract.id);
		const deliverableId = deliverable?.id;
		if (!workTypeId || !deliverableId) return fail(400, { error: 'That work type no longer exists.' });

		const workType = (await listWorkTypesForDeliverable(deliverableId)).find((row) => row.id === workTypeId);
		const result = await deleteWorkTypeWithNote(workTypeId, deliverableId);
		if (!result || !workType) return fail(404, { error: 'That work type no longer exists.' });

		return {
			success: true,
			message: `Deleted work type “${workType.name}”.${entriesKeptMessage(result.annotatedTimeEntryCount, `${deliverable!.name} / ${workType.name}`)}`
		};
	},

	reorderWorkTypes: async ({ request, params, locals }) => {
		const { contract } = await loadOwnedContract(params, locals);
		const formData = await request.formData();
		const deliverable = await readOwnedDeliverable(formData, contract.id);
		const deliverableId = deliverable?.id;
		const orderedIdsRaw = formData.get('ordered_ids')?.toString();
		if (!deliverableId || !orderedIdsRaw) return fail(400, { error: 'Nothing to reorder.' });

		await reorderWorkTypes(deliverableId, orderedIdsRaw.split(',').filter(Boolean));
		return { success: true, message: 'Work type order saved.' };
	}
};
