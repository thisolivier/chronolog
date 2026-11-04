import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDeliverable, listDeliverablesForContract } from '$lib/server/db/queries/deliverables';
import { getContractForUser } from '$lib/server/db/queries/contracts';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';
import {
	firstProblem,
	notFound,
	readId,
	readOptionalSortOrder,
	readRequiredText,
	unauthorized,
	wantsArchived
} from '../admin-input';

/**
 * GET /api/deliverables?contractId=…[&includeArchived=true] — a contract's deliverables in sort
 * order. The contract must be the caller's (404 otherwise). Deliverables have no archive state of
 * their own: under an archived contract or client the list is empty unless `includeArchived=true`,
 * and each row's `archived` says whether its parent is archived.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();

	const rawContractId = url.searchParams.get('contractId');
	if (!rawContractId) return apiError(400, 'contractId query parameter is required', 'invalid_input');
	const contractId = readId(rawContractId, 'contract');
	if (contractId instanceof Response) return apiError(400, 'contractId must be a UUID', 'invalid_id');

	const contract = await getContractForUser(contractId, currentUser.id);
	if (!contract) return notFound('contract');
	const archived = contract.archivedAt !== null || contract.clientArchivedAt !== null;
	if (archived && !wantsArchived(url)) return json([]);

	const deliverableList = await listDeliverablesForContract(contractId);
	return json(deliverableList.map((deliverable) => ({ ...deliverable, archived })));
};

/** POST /api/deliverables — body `{ contractId, name, sortOrder? }` (sortOrder defaults to 0, as on the admin form). */
export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { body } = parsedBody;

	const contractId = readId(body.contractId, 'contract');
	const name = readRequiredText(body, 'name', 'Enter a name for the deliverable.');
	const sortOrder = readOptionalSortOrder(body);
	const problem = firstProblem(contractId, name, sortOrder);
	if (problem) return problem;

	const contract = await getContractForUser(contractId as string, currentUser.id);
	if (!contract) return notFound('contract');

	const deliverable = await createDeliverable(contract.id, name as string, (sortOrder as number | undefined) ?? 0);
	return json(
		{ deliverable, message: `Deliverable “${deliverable.name}” added to ${contract.name}.` },
		{ status: 201 }
	);
};
