import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listDeliverablesForContract } from '$lib/server/db/queries/deliverables';

/** Postgres rejects a non-UUID in a uuid comparison with a 500, so validate the shape here. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/deliverables?contractId=... — list deliverables for a contract */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractId = url.searchParams.get('contractId');
	if (!contractId) {
		throw error(400, 'contractId query parameter is required');
	}
	if (!UUID_PATTERN.test(contractId)) {
		throw error(400, 'contractId must be a UUID');
	}

	const deliverableList = await listDeliverablesForContract(contractId);
	return json(deliverableList);
};
