import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getClientForUser } from '$lib/server/db/queries/clients';
import { getContractForClient, updateContract } from '$lib/server/db/queries/contracts';
import {
	listDeliverablesForContract,
	createDeliverable,
	updateDeliverable,
	deleteDeliverable
} from '$lib/server/db/queries/deliverables';
import {
	listWorkTypesForDeliverable,
	createWorkType,
	updateWorkType,
	deleteWorkType,
	reorderWorkTypes
} from '$lib/server/db/queries/work-types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const client = await getClientForUser(params.clientId, currentUser.id);
	if (!client) throw error(404, 'Client not found');

	const contract = await getContractForClient(params.contractId, client.id);
	if (!contract) throw error(404, 'Contract not found');

	const deliverableList = await listDeliverablesForContract(contract.id);

	// Fetch work types for each deliverable
	const deliverablesWithWorkTypes = await Promise.all(
		deliverableList.map(async (deliverable) => {
			const workTypeList = await listWorkTypesForDeliverable(deliverable.id);
			return { ...deliverable, workTypes: workTypeList };
		})
	);

	return { client, contract, deliverables: deliverablesWithWorkTypes };
};

export const actions: Actions = {
	updateContract: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isActive = formData.get('is_active') === 'on';

		if (!name) return fail(400, { error: 'Contract name is required.' });

		const updatedContract = await updateContract(params.contractId, client.id, {
			name,
			description,
			isActive
		});
		if (!updatedContract) return fail(404, { error: 'Contract not found.' });

		return { success: true };
	},

	createDeliverable: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const contract = await getContractForClient(params.contractId, client.id);
		if (!contract) throw error(404, 'Contract not found');

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const sortOrderRaw = formData.get('sort_order')?.toString() || '0';
		const sortOrder = parseInt(sortOrderRaw, 10) || 0;

		if (!name) return fail(400, { error: 'Deliverable name is required.' });

		await createDeliverable(contract.id, name, sortOrder, currentUser.id);
		return { success: true };
	},

	updateDeliverable: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const contract = await getContractForClient(params.contractId, client.id);
		if (!contract) throw error(404, 'Contract not found');

		const formData = await request.formData();
		const deliverableId = formData.get('deliverable_id')?.toString();
		const name = formData.get('name')?.toString().trim();
		const sortOrderRaw = formData.get('sort_order')?.toString() || '0';
		const sortOrder = parseInt(sortOrderRaw, 10) || 0;

		if (!deliverableId || !name) {
			return fail(400, { error: 'Deliverable ID and name are required.' });
		}

		const updated = await updateDeliverable(deliverableId, contract.id, { name, sortOrder });
		if (!updated) return fail(404, { error: 'Deliverable not found.' });

		return { success: true };
	},

	deleteDeliverable: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const contract = await getContractForClient(params.contractId, client.id);
		if (!contract) throw error(404, 'Contract not found');

		const formData = await request.formData();
		const deliverableId = formData.get('deliverable_id')?.toString();

		if (!deliverableId) return fail(400, { error: 'Deliverable ID is required.' });

		const deleted = await deleteDeliverable(deliverableId, contract.id);
		if (!deleted) return fail(404, { error: 'Deliverable not found.' });

		return { success: true };
	},

	createWorkType: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const contract = await getContractForClient(params.contractId, client.id);
		if (!contract) throw error(404, 'Contract not found');

		const formData = await request.formData();
		const deliverableId = formData.get('deliverable_id')?.toString();
		const name = formData.get('name')?.toString().trim();
		const sortOrderRaw = formData.get('sort_order')?.toString() || '0';
		const sortOrder = parseInt(sortOrderRaw, 10) || 0;

		if (!deliverableId || !name) {
			return fail(400, { error: 'Deliverable ID and work type name are required.' });
		}

		await createWorkType(deliverableId, name, sortOrder, currentUser.id);
		return { success: true };
	},

	updateWorkType: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const contract = await getContractForClient(params.contractId, client.id);
		if (!contract) throw error(404, 'Contract not found');

		const formData = await request.formData();
		const workTypeId = formData.get('work_type_id')?.toString();
		const deliverableId = formData.get('deliverable_id')?.toString();
		const name = formData.get('name')?.toString().trim();
		const sortOrderRaw = formData.get('sort_order')?.toString() || '0';
		const sortOrder = parseInt(sortOrderRaw, 10) || 0;

		if (!workTypeId || !deliverableId || !name) {
			return fail(400, { error: 'Work type ID, deliverable ID, and name are required.' });
		}

		const updated = await updateWorkType(workTypeId, deliverableId, { name, sortOrder });
		if (!updated) return fail(404, { error: 'Work type not found.' });

		return { success: true };
	},

	deleteWorkType: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const contract = await getContractForClient(params.contractId, client.id);
		if (!contract) throw error(404, 'Contract not found');

		const formData = await request.formData();
		const workTypeId = formData.get('work_type_id')?.toString();
		const deliverableId = formData.get('deliverable_id')?.toString();

		if (!workTypeId || !deliverableId) {
			return fail(400, { error: 'Work type ID and deliverable ID are required.' });
		}

		const deleted = await deleteWorkType(workTypeId, deliverableId);
		if (!deleted) return fail(404, { error: 'Work type not found.' });

		return { success: true };
	},

	reorderWorkTypes: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const contract = await getContractForClient(params.contractId, client.id);
		if (!contract) throw error(404, 'Contract not found');

		const formData = await request.formData();
		const deliverableId = formData.get('deliverable_id')?.toString();
		const orderedIdsRaw = formData.get('ordered_ids')?.toString();

		if (!deliverableId || !orderedIdsRaw) {
			return fail(400, { error: 'Deliverable ID and ordered IDs are required.' });
		}

		const orderedIds = orderedIdsRaw.split(',').filter(Boolean);
		await reorderWorkTypes(deliverableId, orderedIds);

		return { success: true };
	}
};
