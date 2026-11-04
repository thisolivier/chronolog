import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWorkType, listWorkTypesForDeliverable } from '$lib/server/db/queries/work-types';
import { getDeliverableForUser } from '$lib/server/db/queries/deliverables';
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
 * GET /api/work-types?deliverableId=…[&includeArchived=true] — a deliverable's work types in
 * sort order. The deliverable must be the caller's (404 otherwise). Like deliverables, work types
 * count as archived with their contract or client: empty unless `includeArchived=true`.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();

	const rawDeliverableId = url.searchParams.get('deliverableId');
	if (!rawDeliverableId) return apiError(400, 'deliverableId query parameter is required', 'invalid_input');
	const deliverableId = readId(rawDeliverableId, 'deliverable');
	if (deliverableId instanceof Response) return apiError(400, 'deliverableId must be a UUID', 'invalid_id');

	const deliverable = await getDeliverableForUser(deliverableId, currentUser.id);
	if (!deliverable) return notFound('deliverable');
	const archived = deliverable.parentArchived;
	if (archived && !wantsArchived(url)) return json([]);

	const workTypeList = await listWorkTypesForDeliverable(deliverableId);
	return json(workTypeList.map((workType) => ({ ...workType, archived })));
};

/** POST /api/work-types — body `{ deliverableId, name, sortOrder? }` (sortOrder defaults to 0). */
export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { body } = parsedBody;

	const deliverableId = readId(body.deliverableId, 'deliverable');
	const name = readRequiredText(body, 'name', 'Enter a name for the work type.');
	const sortOrder = readOptionalSortOrder(body);
	const problem = firstProblem(deliverableId, name, sortOrder);
	if (problem) return problem;

	const deliverable = await getDeliverableForUser(deliverableId as string, currentUser.id);
	if (!deliverable) return notFound('deliverable');

	const workType = await createWorkType(deliverable.id, name as string, (sortOrder as number | undefined) ?? 0);
	return json(
		{ workType: { ...workType, contractId: deliverable.contractId }, message: `Work type “${workType.name}” added.` },
		{ status: 201 }
	);
};
