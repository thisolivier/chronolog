import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listWorkTypesForDeliverable } from '$lib/server/db/queries/work-types';

/** GET /api/work-types?deliverableId=... — list work types for a deliverable */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const deliverableId = url.searchParams.get('deliverableId');
	if (!deliverableId) {
		throw error(400, 'deliverableId query parameter is required');
	}

	const workTypeList = await listWorkTypesForDeliverable(deliverableId);
	return json(workTypeList);
};
