import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db';
import { deleteTimeEntry, getTimeEntryForUser, updateTimeEntry } from '$lib/server/db/queries/time-entries';
import { reconcileTimeEntryLinksInTransaction } from '$lib/server/db/queries/time-entries-batch';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { entryReferenceProblem, isValidDate, readDurationFields, UUID_PATTERN } from '../entry-input';
import type { RequestHandler } from './$types';

type EntryUpdate = Parameters<typeof updateTimeEntry>[2];

/** GET: one of the caller's entries with contract, client, deliverable and work type names. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');
	if (!UUID_PATTERN.test(params.id)) return apiError(404, 'Entry not found', 'not_found');

	const entry = await getTimeEntryForUser(params.id, currentUser.id);
	if (!entry) return apiError(404, 'Entry not found', 'not_found');
	return json({ entry });
};

/**
 * PUT or PATCH: partial update of a time entry. Body (all optional): `contractId`,
 * `deliverableId` / `workTypeId` (null clears), `date`, `durationMinutes` or `duration` text,
 * `description`, `startTime`, `endTime`. When the body names a contract, deliverable or work
 * type, the merged entry (current values plus the changes) must hold together: a contract that is
 * not the caller's is a 403, a deliverable off the contract a 400 `deliverable_mismatch`, a work
 * type not under the deliverable a 400 `work_type_mismatch`. `[[note-id]]` references in a new
 * description are re-linked.
 */
const updateEntry: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const { id } = params;
	if (!UUID_PATTERN.test(id)) return apiError(404, 'Entry not found or unauthorized', 'not_found');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const updateData: EntryUpdate = {};

	if (body.contractId !== undefined) {
		if (typeof body.contractId !== 'string') return apiError(400, 'contractId must be a UUID', 'invalid_contract');
		updateData.contractId = body.contractId;
	}
	// null is a valid value here: it clears the deliverable / work type
	if (body.deliverableId !== undefined) updateData.deliverableId = (body.deliverableId as string) || null;
	if (body.workTypeId !== undefined) updateData.workTypeId = (body.workTypeId as string) || null;
	if (body.date !== undefined) {
		if (!isValidDate(body.date)) return apiError(400, 'date must be YYYY-MM-DD', 'invalid_date');
		updateData.date = body.date;
	}

	const durationFields = readDurationFields(body);
	if (durationFields instanceof Response) return durationFields;
	if (durationFields) {
		updateData.durationMinutes = durationFields.durationMinutes;
		if (durationFields.startTime) {
			updateData.startTime = durationFields.startTime;
			updateData.endTime = durationFields.endTime;
		} else if (body.duration !== undefined) {
			// A plain duration replaces any old time range, which would no longer add up
			updateData.startTime = null;
			updateData.endTime = null;
		}
	}
	if (body.description !== undefined) {
		if (body.description !== null && typeof body.description !== 'string') {
			return apiError(400, 'description must be text', 'bad_request');
		}
		updateData.description = body.description;
	}
	if (body.startTime !== undefined) updateData.startTime = body.startTime as string | null;
	if (body.endTime !== undefined) updateData.endTime = body.endTime as string | null;

	if (Object.keys(updateData).length === 0) return apiError(400, 'No fields to update');

	// Validate the merged result whenever a reference is in the body, so a new deliverable with
	// the entry's stale work type is rejected rather than silently kept
	const touchesReferences =
		updateData.contractId !== undefined || updateData.deliverableId !== undefined || updateData.workTypeId !== undefined;
	if (touchesReferences) {
		const existing = await getTimeEntryForUser(id, currentUser.id);
		if (!existing) return apiError(404, 'Entry not found or unauthorized', 'not_found');
		const referenceProblem = await entryReferenceProblem({
			userId: currentUser.id,
			contractId: updateData.contractId ?? existing.contractId,
			deliverableId: updateData.deliverableId !== undefined ? updateData.deliverableId : existing.deliverableId,
			workTypeId: updateData.workTypeId !== undefined ? updateData.workTypeId : existing.workTypeId
		});
		if (referenceProblem) return referenceProblem;
	}

	const updated = await updateTimeEntry(id, currentUser.id, updateData);
	if (!updated) return apiError(404, 'Entry not found or unauthorized', 'not_found');

	// Reconcile wiki-link references in description
	if (body.description !== undefined) {
		const description = (body.description as string | null) || null;
		await database.transaction((transaction) => reconcileTimeEntryLinksInTransaction(transaction, id, description));
	}

	return json({ success: true, entry: updated });
};

export const PUT = updateEntry;
export const PATCH = updateEntry;

/** DELETE: remove one of the caller's time entries. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const { id } = params;
	if (!UUID_PATTERN.test(id)) return apiError(404, 'Entry not found or unauthorized', 'not_found');

	const deleted = await deleteTimeEntry(id, currentUser.id);
	if (!deleted) return apiError(404, 'Entry not found or unauthorized', 'not_found');

	return json({ success: true, deleted });
};
