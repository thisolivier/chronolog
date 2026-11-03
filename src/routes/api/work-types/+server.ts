import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listWorkTypesForDeliverable } from '$lib/server/db/queries/work-types';

/** Postgres rejects a non-UUID in a uuid comparison with a 500, so validate the shape here. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/work-types?deliverableId=... — list work types for a deliverable */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const deliverableId = url.searchParams.get('deliverableId');
	if (!deliverableId) {
		throw error(400, 'deliverableId query parameter is required');
	}
	if (!UUID_PATTERN.test(deliverableId)) {
		throw error(400, 'deliverableId must be a UUID');
	}

	const workTypeList = await listWorkTypesForDeliverable(deliverableId);
	return json(workTypeList);
};
