import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDeliverableForUser, updateDeliverable } from '$lib/server/db/queries/deliverables';
import { deleteDeliverableWithNote, getEntryCountsBy } from '$lib/server/db/queries/safe-deletion';
import { entriesKeptMessage } from '$lib/server/admin-actions';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';
import {
	firstProblem,
	notFound,
	readId,
	readOptionalSortOrder,
	readOptionalText,
	unauthorized
} from '../../admin-input';

/** GET /api/deliverables/:id — one of the user's deliverables, with its `contractId` (sprint 031-CL). */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return unauthorized();
	const deliverableId = readId(params.id, 'deliverable');
	if (deliverableId instanceof Response) return deliverableId;

	const deliverable = await getDeliverableForUser(deliverableId, locals.user.id);
	if (!deliverable) return notFound('deliverable');
	const { parentArchived, ...fields } = deliverable;
	const usage = (await getEntryCountsBy('deliverableId', [deliverable.id])).get(deliverable.id) ?? { timeEntryCount: 0, totalMinutes: 0 };
	return json({ deliverable: { ...fields, archived: parentArchived }, usage });
};

/** PATCH /api/deliverables/:id — body `{ name?, sortOrder? }`. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const deliverableId = readId(params.id, 'deliverable');
	if (deliverableId instanceof Response) return deliverableId;

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const name = readOptionalText(parsedBody.body, 'name', 'A deliverable needs a name.');
	const sortOrder = readOptionalSortOrder(parsedBody.body);
	const problem = firstProblem(name, sortOrder);
	if (problem) return problem;
	if (name === undefined && sortOrder === undefined) return apiError(400, 'No fields to update', 'invalid_input');

	const owned = await getDeliverableForUser(deliverableId, currentUser.id);
	if (!owned) return notFound('deliverable');

	const updated = await updateDeliverable(deliverableId, owned.contractId, {
		...(name !== undefined ? { name: name as string } : {}),
		...(sortOrder !== undefined ? { sortOrder: sortOrder as number } : {})
	});
	if (!updated) return notFound('deliverable');
	return json({ deliverable: updated, message: `Deliverable “${updated.name}” saved.` });
};

/**
 * DELETE /api/deliverables/:id — the admin page's safe deletion: entries that used it stay on the
 * contract, keep "Formerly: <deliverable>[ / <work type>]" in their description, and lose the
 * deliverable and work type; its work types go with it. Answers how many entries were annotated.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const deliverableId = readId(params.id, 'deliverable');
	if (deliverableId instanceof Response) return deliverableId;

	const deliverable = await getDeliverableForUser(deliverableId, currentUser.id);
	if (!deliverable) return notFound('deliverable');

	const result = await deleteDeliverableWithNote(deliverable.id, deliverable.contractId);
	if (!result) return notFound('deliverable');

	return json({
		deleted: { kind: 'deliverable', id: deliverable.id, name: deliverable.name, contractId: deliverable.contractId },
		...result,
		message: `Deleted deliverable “${deliverable.name}”.${entriesKeptMessage(result.annotatedTimeEntryCount, deliverable.name)}`
	});
};
