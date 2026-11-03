import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listContractsByClientWithNoteCount } from '$lib/server/db/queries/contracts';

/**
 * GET /api/contracts-by-client
 *
 * Returns a flat list of contracts with client name and note count.
 * Ordered by sortOrder then contract name.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractList = await listContractsByClientWithNoteCount(currentUser.id);

	return json({
		contracts: contractList.map((row) => ({
			id: row.id,
			name: row.name,
			isActive: row.isActive,
			sortOrder: row.sortOrder,
			clientId: row.clientId,
			clientName: row.clientName,
			clientShortCode: row.clientShortCode,
			clientEmoji: row.clientEmoji,
			clientColorIndex: row.clientColorIndex,
			noteCount: row.noteCount
		}))
	});
};
