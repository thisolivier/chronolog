import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { database, noteTimeEntries } from '$lib/server/db';
import { deleteTimeEntry, getTimeEntryForUser, updateTimeEntry } from '$lib/server/db/queries/time-entries';
import { linkTimeEntryToNote, unlinkTimeEntryFromNote } from '$lib/server/db/queries/notes';
import { extractDescriptionLinks, reconcileLinks } from '$lib/utils/reconcile-description-links';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { checkContractAccess, isValidDate, readDurationFields, UUID_PATTERN } from '../entry-input';
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
 * `description`, `startTime`, `endTime`. A contract that is not the caller's is a 403; a
 * deliverable must belong to the entry's (new or current) contract. `[[note-id]]` references in
 * a new description are re-linked.
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

	if (updateData.contractId !== undefined || updateData.deliverableId) {
		const existing = await getTimeEntryForUser(id, currentUser.id);
		if (!existing) return apiError(404, 'Entry not found or unauthorized', 'not_found');
		const accessProblem = await checkContractAccess(
			currentUser.id,
			updateData.contractId ?? existing.contractId,
			updateData.deliverableId
		);
		if (accessProblem) return accessProblem;
	}

	const updated = await updateTimeEntry(id, currentUser.id, updateData);
	if (!updated) return apiError(404, 'Entry not found or unauthorized', 'not_found');

	// Reconcile wiki-link references in description
	if (body.description !== undefined) {
		const desiredLinks = extractDescriptionLinks((body.description as string | null) || '');
		const currentLinks = await database
			.select()
			.from(noteTimeEntries)
			.where(eq(noteTimeEntries.timeEntryId, id));
		const { toAdd, toRemove } = reconcileLinks(currentLinks, desiredLinks);

		for (const link of toAdd) {
			try {
				await linkTimeEntryToNote(link.noteId, id, link.headingAnchor);
			} catch {
				// Silently ignore if note doesn't exist
			}
		}
		for (const link of toRemove) {
			await unlinkTimeEntryFromNote(link.noteId, id);
		}
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
