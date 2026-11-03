import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	listClientsForUser,
	createClient,
	updateClient,
	deleteClient
} from '$lib/server/db/queries/clients';
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
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const clientList = await listClientsForUser(currentUser.id);
	return { clients: clientList };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const shortCode = formData.get('short_code')?.toString().trim();
		const emoji = formData.get('emoji')?.toString().trim() || null;

		if (!name || !shortCode) {
			return fail(400, { error: 'Name and short code are required.', name, shortCode });
		}

		const colorIndex = parseColorIndexField(formData);
		if (colorIndex === null) {
			return fail(400, { error: INVALID_COLOR_MESSAGE, name, shortCode });
		}

		try {
			await createClient(currentUser.id, name, shortCode, emoji, colorIndex);
		} catch (databaseError: unknown) {
			const errorMessage =
				databaseError instanceof Error ? databaseError.message : 'Unknown error';
			if (errorMessage.includes('unique')) {
				return fail(400, {
					error: 'A client with this short code already exists.',
					name,
					shortCode
				});
			}
			return fail(500, { error: 'Failed to create client.', name, shortCode });
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const clientId = formData.get('client_id')?.toString();
		const name = formData.get('name')?.toString().trim();
		const shortCode = formData.get('short_code')?.toString().trim();
		const emojiRaw = formData.get('emoji')?.toString().trim();
		const emoji = emojiRaw === '' || emojiRaw === undefined ? null : emojiRaw;

		if (!clientId || !name || !shortCode) {
			return fail(400, { error: 'Client ID, name, and short code are required.' });
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
				return fail(404, { error: 'Client not found.' });
			}
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

	delete: async ({ request, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const clientId = formData.get('client_id')?.toString();

		if (!clientId) {
			return fail(400, { error: 'Client ID is required.' });
		}

		const deletedClient = await deleteClient(clientId, currentUser.id);
		if (!deletedClient) {
			return fail(404, { error: 'Client not found.' });
		}

		return { success: true };
	}
};
