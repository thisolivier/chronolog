import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getClientForUser, updateClient } from '$lib/server/db/queries/clients';
import {
	listContractsForClient,
	createContract,
	updateContract,
	deleteContract
} from '$lib/server/db/queries/contracts';

export const load: PageServerLoad = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const client = await getClientForUser(params.clientId, currentUser.id);
	if (!client) throw error(404, 'Client not found');

	const contractList = await listContractsForClient(client.id);

	return { client, contracts: contractList };
};

export const actions: Actions = {
	updateClient: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const shortCode = formData.get('short_code')?.toString().trim();

		if (!name || !shortCode) {
			return fail(400, { error: 'Name and short code are required.' });
		}

		try {
			const updatedClient = await updateClient(params.clientId, currentUser.id, {
				name,
				shortCode
			});
			if (!updatedClient) return fail(404, { error: 'Client not found.' });
		} catch (databaseError: unknown) {
			const errorMessage =
				databaseError instanceof Error ? databaseError.message : 'Unknown error';
			if (errorMessage.includes('unique')) {
				return fail(400, { error: 'A client with this short code already exists.' });
			}
			return fail(500, { error: 'Failed to update client.' });
		}

		return { success: true };
	},

	createContract: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		// Verify client ownership
		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isActive = formData.get('is_active') === 'on';

		if (!name) {
			return fail(400, { error: 'Contract name is required.' });
		}

		await createContract(client.id, name, description, isActive);
		return { success: true };
	},

	updateContract: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const formData = await request.formData();
		const contractId = formData.get('contract_id')?.toString();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isActive = formData.get('is_active') === 'on';

		if (!contractId || !name) {
			return fail(400, { error: 'Contract ID and name are required.' });
		}

		const updatedContract = await updateContract(contractId, client.id, {
			name,
			description,
			isActive
		});
		if (!updatedContract) return fail(404, { error: 'Contract not found.' });

		return { success: true };
	},

	deleteContract: async ({ request, params, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const client = await getClientForUser(params.clientId, currentUser.id);
		if (!client) throw error(404, 'Client not found');

		const formData = await request.formData();
		const contractId = formData.get('contract_id')?.toString();

		if (!contractId) {
			return fail(400, { error: 'Contract ID is required.' });
		}

		const deletedContract = await deleteContract(contractId, client.id);
		if (!deletedContract) return fail(404, { error: 'Contract not found.' });

		return { success: true };
	}
};
