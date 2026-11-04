import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	listClientsForUser,
	createClient,
	updateClient,
	getClientForUser,
	setClientArchived,
	nextClientColorIndex
} from '$lib/server/db/queries/clients';
import { listContractRefsForUser } from '$lib/server/db/queries/contracts';
import {
	deleteClientWithReassignment,
	getClientUsage,
	getContractUsage,
	sumUsage
} from '$lib/server/db/queries/safe-deletion';
import {
	archiveMessage,
	deletionMessage,
	duplicateShortCodeMessage,
	isUniqueViolation,
	readUuidField,
	requireUser
} from '$lib/server/admin-actions';
import { isValidClientColorIndex } from '$lib/utils/client-colors';

/**
 * Parses the optional `color_index` form field. Returns `undefined` when absent (keep the
 * default / existing value) and `null` when present but not a valid palette index.
 */
function parseColorIndexField(formData: FormData): number | null | undefined {
	const rawValue = formData.get('color_index')?.toString().trim();
	if (rawValue === undefined || rawValue === '') return undefined;
	const parsedValue = Number(rawValue);
	return isValidClientColorIndex(parsedValue) ? parsedValue : null;
}

const INVALID_COLOR_MESSAGE = 'Colour must be a palette index between 0 and 7.';

export const load: PageServerLoad = async ({ locals }) => {
	const currentUser = requireUser(locals);

	const clientList = await listClientsForUser(currentUser.id, { includeArchived: true });
	const contractRefs = await listContractRefsForUser(currentUser.id);
	const usageByContract = await getContractUsage(contractRefs.map((contract) => contract.id));

	return {
		clients: clientList.map((client) => {
			const clientContractIds = contractRefs
				.filter((contract) => contract.clientId === client.id)
				.map((contract) => contract.id);
			const usage = sumUsage(
				clientContractIds.flatMap((contractId) => usageByContract.get(contractId) ?? [])
			);
			return { ...client, usage: { ...usage, contractCount: clientContractIds.length } };
		})
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const currentUser = requireUser(locals);

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const shortCode = formData.get('short_code')?.toString().trim();
		const emoji = formData.get('emoji')?.toString().trim() || null;

		if (!name || !shortCode) {
			return fail(400, { error: 'Enter both a name and a short code for the client.', name, shortCode });
		}

		const colorIndex = parseColorIndexField(formData);
		if (colorIndex === null) {
			return fail(400, { error: INVALID_COLOR_MESSAGE, name, shortCode });
		}

		try {
			await createClient(currentUser.id, name, shortCode, emoji, colorIndex ?? (await nextClientColorIndex(currentUser.id)));
		} catch (databaseError: unknown) {
			if (isUniqueViolation(databaseError)) {
				return fail(400, { error: duplicateShortCodeMessage(shortCode), name, shortCode });
			}
			console.error('Failed to create client:', databaseError);
			return fail(500, { error: `Couldn’t create client “${name}”: the server hit an error.`, name, shortCode });
		}

		return { success: true, message: `Client “${name}” created.` };
	},

	update: async ({ request, locals }) => {
		const currentUser = requireUser(locals);

		const formData = await request.formData();
		const clientId = readUuidField(formData, 'client_id');
		const name = formData.get('name')?.toString().trim();
		const shortCode = formData.get('short_code')?.toString().trim();
		const emojiRaw = formData.get('emoji')?.toString().trim();
		const emoji = emojiRaw === '' || emojiRaw === undefined ? null : emojiRaw;

		if (!clientId || !name || !shortCode) {
			return fail(400, { error: 'A client needs both a name and a short code.' });
		}

		const colorIndex = parseColorIndexField(formData);
		if (colorIndex === null) {
			return fail(400, { error: INVALID_COLOR_MESSAGE });
		}

		try {
			const updatedClient = await updateClient(clientId, currentUser.id, {
				name,
				shortCode,
				emoji,
				...(colorIndex !== undefined ? { colorIndex } : {})
			});
			if (!updatedClient) {
				return fail(404, { error: 'That client no longer exists. Reload the page.' });
			}
		} catch (databaseError: unknown) {
			if (isUniqueViolation(databaseError)) {
				return fail(400, { error: duplicateShortCodeMessage(shortCode) });
			}
			console.error('Failed to update client:', databaseError);
			return fail(500, { error: `Couldn’t save client “${name}”: the server hit an error.` });
		}

		return { success: true, message: `Client “${name}” saved.` };
	},

	archive: async ({ request, locals }) => setArchived(request, locals, true),
	unarchive: async ({ request, locals }) => setArchived(request, locals, false),

	delete: async ({ request, locals }) => {
		const currentUser = requireUser(locals);

		const formData = await request.formData();
		const clientId = readUuidField(formData, 'client_id');
		if (!clientId) return fail(400, { error: 'Missing client ID.' });

		const client = await getClientForUser(clientId, currentUser.id);
		if (!client) return fail(404, { error: 'That client no longer exists. Reload the page.' });

		const usage = await getClientUsage(clientId, currentUser.id);

		const result = await deleteClientWithReassignment(clientId, currentUser.id);
		if (!result) return fail(404, { error: 'That client no longer exists. Reload the page.' });

		return { success: true, message: deletionMessage(client.name, result, usage.totalMinutes) };
	}
};

async function setArchived(request: Request, locals: App.Locals, archived: boolean) {
	const currentUser = requireUser(locals);
	const formData = await request.formData();
	const clientId = readUuidField(formData, 'client_id');
	if (!clientId) return fail(400, { error: 'Missing client ID.' });

	const client = await setClientArchived(clientId, currentUser.id, archived);
	if (!client) return fail(404, { error: 'That client no longer exists. Reload the page.' });
	return { success: true, message: archiveMessage('client', client.name, archived) };
}
