import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createContract,
	listContractsWithClientForUser,
	verifyClientOwnership
} from '$lib/server/db/queries/contracts';
import { createClient, nextClientColorIndex } from '$lib/server/db/queries/clients';
import { isUniqueViolation } from '$lib/server/admin-actions';
import { duplicateShortCode, notFound } from '../admin-input';
import { isUuid } from '$lib/utils/uuid';

/** GET /api/contracts — the user's visible contracts (not archived, not system), with client info */
export const GET: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractList = await listContractsWithClientForUser(currentUser.id);
	return json(contractList);
};

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '';
}

/**
 * POST /api/contracts — create a contract. Body: `{ clientId, name, description?, isActive? }`,
 * or `{ newClient: { name, shortCode }, name, … }` to create the client first (sprint 026-CL:
 * the sidebar's New Contract modal can add a client inline). A short code already in use is
 * 409 `duplicate`; a client that is not the caller's is 404 (sprint 031-CL).
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, 'Invalid JSON body');
	const { name, description, isActive, newClient } = body;
	let { clientId } = body;

	if (!isNonEmptyString(name)) throw error(400, 'Enter a name for the contract.');

	if (newClient !== undefined) {
		if (!isNonEmptyString(newClient?.name) || !isNonEmptyString(newClient?.shortCode)) {
			throw error(400, 'Enter both a name and a short code for the new client.');
		}
		try {
			const client = await createClient(
				currentUser.id,
				newClient.name.trim(),
				newClient.shortCode.trim(),
				null,
				await nextClientColorIndex(currentUser.id)
			);
			clientId = client.id;
		} catch (databaseError) {
			if (isUniqueViolation(databaseError)) return duplicateShortCode(newClient.shortCode.trim());
			throw databaseError;
		}
	} else {
		if (!isNonEmptyString(clientId)) throw error(400, 'Pick a client for the contract.');
		// Another user's client is the same 404 as a missing one (sprint 031-CL), never a 403
		const isOwner = isUuid(clientId) && (await verifyClientOwnership(clientId, currentUser.id));
		if (!isOwner) return notFound('client');
	}

	const contract = await createContract(
		clientId,
		name.trim(),
		typeof description === 'string' && description.trim() ? description.trim() : null,
		isActive ?? true
	);
	return json({ contract, id: contract.id, clientId }, { status: 201 });
};
