import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listContractsByClientWithNoteCount } from '$lib/server/db/queries/contracts';

/**
 * GET /api/contracts-by-client
 *
 * Returns a flat list of contracts with client name and note count.
 * Ordered by sortOrder then contract name. With `?includeArchived=true`, archived contracts and
 * the contracts of archived clients are included (`archived`, `clientArchived`; sprint 031-CL).
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractList = await listContractsByClientWithNoteCount(currentUser.id, {
		includeArchived: url.searchParams.get('includeArchived') === 'true'
	});

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
			noteCount: row.noteCount,
			archived: row.archivedAt !== null,
			clientArchived: row.clientArchivedAt !== null
		}))
	});
};
