import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWorkTypeForUser, updateWorkType } from '$lib/server/db/queries/work-types';
import { deleteWorkTypeWithNote } from '$lib/server/db/queries/safe-deletion';
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

/** GET /api/work-types/:id — one of the user's work types, with `deliverableName` and `contractId`. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return unauthorized();
	const workTypeId = readId(params.id, 'work type');
	if (workTypeId instanceof Response) return workTypeId;

	const workType = await getWorkTypeForUser(workTypeId, locals.user.id);
	if (!workType) return notFound('work type');
	const { parentArchived, ...fields } = workType;
	return json({ workType: { ...fields, archived: parentArchived } });
};

/** PATCH /api/work-types/:id — body `{ name?, sortOrder? }`. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const workTypeId = readId(params.id, 'work type');
	if (workTypeId instanceof Response) return workTypeId;

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const name = readOptionalText(parsedBody.body, 'name', 'A work type needs a name.');
	const sortOrder = readOptionalSortOrder(parsedBody.body);
	const problem = firstProblem(name, sortOrder);
	if (problem) return problem;
	if (name === undefined && sortOrder === undefined) return apiError(400, 'No fields to update', 'invalid_input');

	const owned = await getWorkTypeForUser(workTypeId, currentUser.id);
	if (!owned) return notFound('work type');

	const updated = await updateWorkType(workTypeId, owned.deliverableId, {
		...(name !== undefined ? { name: name as string } : {}),
		...(sortOrder !== undefined ? { sortOrder: sortOrder as number } : {})
	});
	if (!updated) return notFound('work type');
	return json({ workType: updated, message: `Work type “${updated.name}” saved.` });
};

/**
 * DELETE /api/work-types/:id — the admin page's safe deletion: entries keep their deliverable,
 * lose the work type and keep "Formerly: <deliverable> / <work type>" in their description.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const workTypeId = readId(params.id, 'work type');
	if (workTypeId instanceof Response) return workTypeId;

	const workType = await getWorkTypeForUser(workTypeId, currentUser.id);
	if (!workType) return notFound('work type');

	const result = await deleteWorkTypeWithNote(workType.id, workType.deliverableId);
	if (!result) return notFound('work type');

	const formerName = `${workType.deliverableName} / ${workType.name}`;
	return json({
		deleted: { kind: 'work type', id: workType.id, name: workType.name, deliverableId: workType.deliverableId },
		...result,
		message: `Deleted work type “${workType.name}”.${entriesKeptMessage(result.annotatedTimeEntryCount, formerName)}`
	});
};
