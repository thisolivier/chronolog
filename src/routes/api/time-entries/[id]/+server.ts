import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { database, noteTimeEntries } from '$lib/server/db';
import { deleteTimeEntry, updateTimeEntry } from '$lib/server/db/queries/time-entries';
import { linkTimeEntryToNote, unlinkTimeEntryFromNote } from '$lib/server/db/queries/notes';
import { extractDescriptionLinks, reconcileLinks } from '$lib/utils/reconcile-description-links';
import type { RequestHandler } from './$types';

/** PUT: Update a time entry (partial updates) */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;
	if (!id) {
		return json({ error: 'Missing entry ID' }, { status: 400 });
	}

	const body = await request.json();
	const updateData: Record<string, unknown> = {};

	if (body.contractId !== undefined) updateData.contractId = body.contractId;
	// null is a valid value here: it clears the deliverable / work type
	if (body.deliverableId !== undefined) updateData.deliverableId = body.deliverableId || null;
	if (body.workTypeId !== undefined) updateData.workTypeId = body.workTypeId || null;
	if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes;
	if (body.description !== undefined) updateData.description = body.description;
	if (body.startTime !== undefined) updateData.startTime = body.startTime;
	if (body.endTime !== undefined) updateData.endTime = body.endTime;

	if (Object.keys(updateData).length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	const updated = await updateTimeEntry(id, currentUser.id, updateData);

	if (!updated) {
		return json({ error: 'Entry not found or unauthorized' }, { status: 404 });
	}

	// Reconcile wiki-link references in description
	if (body.description !== undefined) {
		const desiredLinks = extractDescriptionLinks(body.description || '');

		const currentLinksResponse = await database
			.select()
			.from(noteTimeEntries)
			.where(eq(noteTimeEntries.timeEntryId, id));

		const { toAdd, toRemove } = reconcileLinks(currentLinksResponse, desiredLinks);

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

/** DELETE: Remove a time entry */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;
	if (!id) {
		return json({ error: 'Missing entry ID' }, { status: 400 });
	}

	const deleted = await deleteTimeEntry(id, currentUser.id);

	if (!deleted) {
		return json({ error: 'Entry not found or unauthorized' }, { status: 404 });
	}

	return json({ success: true, deleted });
};
