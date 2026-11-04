import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getContractForUser, setContractArchived, updateContract } from '$lib/server/db/queries/contracts';
import { deleteContractWithReassignment, getContractUsage } from '$lib/server/db/queries/safe-deletion';
import { archiveMessage, deletionMessage } from '$lib/server/admin-actions';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';
import {
	contractJson,
	firstProblem,
	notFound,
	readClearableText,
	readId,
	readOptionalBoolean,
	readOptionalText,
	unauthorized
} from '../../admin-input';

/** GET /api/contracts/:id — one of the user's contracts, archived or not, with delete `usage` (sprint 031-CL). */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return unauthorized();
	const contractId = readId(params.id, 'contract');
	if (contractId instanceof Response) return contractId;

	const contract = await getContractForUser(contractId, locals.user.id);
	if (!contract) return notFound('contract');
	const usage = (await getContractUsage([contract.id])).get(contract.id) ?? { timeEntryCount: 0, totalMinutes: 0, noteCount: 0 };
	return json({ contract: { ...contractJson(contract), clientArchived: contract.clientArchivedAt !== null }, usage });
};

/**
 * PATCH /api/contracts/:id — body `{ name?, description?, isActive?, archived? }`.
 * `description: null` (or blank) clears it; `archived: true|false` archives or restores.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const contractId = readId(params.id, 'contract');
	if (contractId instanceof Response) return contractId;

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { body } = parsedBody;

	const name = readOptionalText(body, 'name', 'A contract needs a name.');
	const description = readClearableText(body, 'description');
	const isActive = readOptionalBoolean(body, 'isActive');
	const archived = readOptionalBoolean(body, 'archived');
	const problem = firstProblem(name, description, isActive, archived);
	if (problem) return problem;

	const updateData: { name?: string; description?: string | null; isActive?: boolean } = {};
	if (name !== undefined) updateData.name = name as string;
	if (description !== undefined) updateData.description = description as string | null;
	if (isActive !== undefined) updateData.isActive = isActive as boolean;
	if (Object.keys(updateData).length === 0 && archived === undefined) {
		return apiError(400, 'No fields to update', 'invalid_input');
	}

	const owned = await getContractForUser(contractId, currentUser.id);
	if (!owned) return notFound('contract');
	let contract: Parameters<typeof contractJson>[0] = owned;
	const messages: string[] = [];

	if (Object.keys(updateData).length > 0) {
		const updated = await updateContract(contractId, owned.clientId, updateData);
		if (!updated) return notFound('contract');
		contract = updated;
		messages.push(`Contract “${contract.name}” saved.`);
	}
	if (archived !== undefined) {
		const toggled = await setContractArchived(contractId, owned.clientId, archived as boolean);
		if (!toggled) return notFound('contract');
		contract = toggled;
		messages.push(archiveMessage('contract', contract.name, archived as boolean));
	}

	return json({ contract: contractJson(contract), message: messages.join(' ') });
};

/**
 * DELETE /api/contracts/:id — the admin page's safe deletion: entries and notes move to the
 * system "Deleted Client / Deleted Contract" first, in one transaction. Answers what moved.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const contractId = readId(params.id, 'contract');
	if (contractId instanceof Response) return contractId;

	const contract = await getContractForUser(contractId, currentUser.id);
	if (!contract) return notFound('contract');
	const usage = (await getContractUsage([contract.id])).get(contract.id);
	const minutesMoved = usage?.totalMinutes ?? 0;

	const result = await deleteContractWithReassignment(contract.id, currentUser.id);
	if (!result) return notFound('contract');

	return json({
		deleted: { kind: 'contract', id: contract.id, name: contract.name, clientId: contract.clientId },
		...result,
		minutesMoved,
		message: deletionMessage(contract.name, result, minutesMoved)
	});
};
