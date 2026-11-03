import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createContract,
	listContractsWithClientForUser,
	verifyClientOwnership
} from '$lib/server/db/queries/contracts';
import { createClient, listClientsForUser } from '$lib/server/db/queries/clients';
import { isUniqueViolation } from '$lib/server/admin-actions';
import { CLIENT_COLORS } from '$lib/utils/client-colors';

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
 * the sidebar's New Contract modal can add a client inline).
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
		const existingClients = await listClientsForUser(currentUser.id, { includeArchived: true });
		const usedColors = new Set(existingClients.map((client) => client.colorIndex % CLIENT_COLORS.length));
		const freeColor = CLIENT_COLORS.findIndex((_, colorIndex) => !usedColors.has(colorIndex));
		try {
			const client = await createClient(
				currentUser.id,
				newClient.name.trim(),
				newClient.shortCode.trim(),
				null,
				freeColor === -1 ? existingClients.length % CLIENT_COLORS.length : freeColor
			);
			clientId = client.id;
		} catch (databaseError) {
			if (isUniqueViolation(databaseError)) {
				throw error(400, `Short code “${newClient.shortCode.trim()}” is already used by another client.`);
			}
			throw databaseError;
		}
	} else {
		if (!isNonEmptyString(clientId)) throw error(400, 'Pick a client for the contract.');
		const isOwner = await verifyClientOwnership(clientId, currentUser.id);
		if (!isOwner) throw error(403, 'Client does not belong to this user');
	}

	const contract = await createContract(clientId, name.trim(), description ?? null, isActive ?? true);
	return json({ contract, id: contract.id, clientId }, { status: 201 });
};
