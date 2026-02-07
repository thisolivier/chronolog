import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listDeliverablesForContract } from '$lib/server/db/queries/deliverables';

/** GET /api/deliverables?contractId=... — list deliverables for a contract */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractId = url.searchParams.get('contractId');
	if (!contractId) {
		throw error(400, 'contractId query parameter is required');
	}

	const deliverableList = await listDeliverablesForContract(contractId);
	return json(deliverableList);
};
