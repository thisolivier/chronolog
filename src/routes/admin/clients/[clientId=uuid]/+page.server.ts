import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getClientForUser, updateClient } from '$lib/server/db/queries/clients';
import {
	listContractsForClient,
	createContract,
	updateContract,
	getContractForClient,
	setContractArchived
} from '$lib/server/db/queries/contracts';
import { deleteContractWithReassignment, getContractUsage } from '$lib/server/db/queries/safe-deletion';
import {
	archiveMessage,
	deletionMessage,
	duplicateShortCodeMessage,
	isUniqueViolation,
	readUuidField,
	requireUser
} from '$lib/server/admin-actions';

const EMPTY_USAGE = { timeEntryCount: 0, totalMinutes: 0, noteCount: 0 };
const GONE = 'That contract no longer exists. Reload the page.';

async function loadOwnedClient(clientId: string, locals: App.Locals) {
	const currentUser = requireUser(locals);
	const client = await getClientForUser(clientId, currentUser.id);
	if (!client) throw error(404, 'Client not found');
	return { currentUser, client };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { client } = await loadOwnedClient(params.clientId, locals);
	const contractList = await listContractsForClient(client.id);
	const usageByContract = await getContractUsage(contractList.map((contract) => contract.id));

	return {
		client,
		contracts: contractList.map((contract) => ({
			...contract,
			usage: usageByContract.get(contract.id) ?? EMPTY_USAGE
		}))
	};
};

export const actions: Actions = {
	updateClient: async ({ request, params, locals }) => {
		const currentUser = requireUser(locals);

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const shortCode = formData.get('short_code')?.toString().trim();

		if (!name || !shortCode) {
			return fail(400, { error: 'A client needs both a name and a short code.' });
		}

		try {
			const updatedClient = await updateClient(params.clientId, currentUser.id, { name, shortCode });
			if (!updatedClient) return fail(404, { error: 'That client no longer exists.' });
		} catch (databaseError: unknown) {
			if (isUniqueViolation(databaseError)) {
				return fail(400, { error: duplicateShortCodeMessage(shortCode) });
			}
			console.error('Failed to update client:', databaseError);
			return fail(500, { error: `Couldn’t save client “${name}”: the server hit an error.` });
		}

		return { success: true, message: `Client “${name}” saved.` };
	},

	createContract: async ({ request, params, locals }) => {
		const { client } = await loadOwnedClient(params.clientId, locals);

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isActive = formData.get('is_active') === 'on';

		if (!name) return fail(400, { error: 'Enter a name for the contract.' });

		await createContract(client.id, name, description, isActive);
		return { success: true, message: `Contract “${name}” added to ${client.name}.` };
	},

	updateContract: async ({ request, params, locals }) => {
		const { client } = await loadOwnedClient(params.clientId, locals);

		const formData = await request.formData();
		const contractId = readUuidField(formData, 'contract_id');
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const isActive = formData.get('is_active') === 'on';

		if (!contractId) return fail(400, { error: GONE });
		if (!name) return fail(400, { error: 'A contract needs a name.' });

		const updatedContract = await updateContract(contractId, client.id, { name, description, isActive });
		if (!updatedContract) return fail(404, { error: GONE });

		return { success: true, message: `Contract “${name}” saved.` };
	},

	archiveContract: async ({ request, params, locals }) =>
		setArchived(request, params.clientId, locals, true),
	unarchiveContract: async ({ request, params, locals }) =>
		setArchived(request, params.clientId, locals, false),

	deleteContract: async ({ request, params, locals }) => {
		const { currentUser, client } = await loadOwnedClient(params.clientId, locals);

		const formData = await request.formData();
		const contractId = readUuidField(formData, 'contract_id');
		if (!contractId) return fail(400, { error: GONE });

		const contract = await getContractForClient(contractId, client.id);
		if (!contract) return fail(404, { error: GONE });
		const usage = (await getContractUsage([contract.id])).get(contract.id) ?? EMPTY_USAGE;

		const result = await deleteContractWithReassignment(contract.id, currentUser.id);
		if (!result) return fail(404, { error: GONE });

		return { success: true, message: deletionMessage(contract.name, result, usage.totalMinutes) };
	}
};

async function setArchived(request: Request, clientId: string, locals: App.Locals, archived: boolean) {
	const { client } = await loadOwnedClient(clientId, locals);
	const formData = await request.formData();
	const contractId = readUuidField(formData, 'contract_id');
	if (!contractId) return fail(400, { error: GONE });

	const contract = await setContractArchived(contractId, client.id, archived);
	if (!contract) return fail(404, { error: GONE });
	return { success: true, message: archiveMessage('contract', contract.name, archived) };
}
