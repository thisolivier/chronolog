import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createContract,
	listContractsWithClientForUser,
	verifyClientOwnership
} from '$lib/server/db/queries/contracts';

/** GET /api/contracts — list contracts for the current user, with client info */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractList = await listContractsWithClientForUser(currentUser.id);
	return json(contractList);
};

/** POST /api/contracts — create a new contract */
export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { clientId, name, description, isActive } = body;

	if (!clientId || !name) {
		throw error(400, 'clientId and name are required');
	}

	const isOwner = await verifyClientOwnership(clientId, currentUser.id);
	if (!isOwner) {
		throw error(403, 'Client does not belong to this user');
	}

	const contract = await createContract(clientId, name, description ?? null, isActive ?? true);
	return json({ contract }, { status: 201 });
};
