import { json } from '@sveltejs/kit';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import { linkTimeEntryToNote } from '$lib/server/db/queries/notes';
import { extractDescriptionLinks } from '$lib/utils/reconcile-description-links';
import type { RequestHandler } from './$types';

/** POST: Create a manual time entry */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { date, durationMinutes, contractId, deliverableId, workTypeId, description, startTime, endTime } =
		body;

	if (!date || durationMinutes === undefined || !contractId) {
		return json(
			{ error: 'Missing required fields: date, durationMinutes, contractId' },
			{ status: 400 }
		);
	}

	const entry = await createTimeEntry({
		userId: currentUser.id,
		contractId,
		deliverableId: deliverableId || null,
		workTypeId: workTypeId || null,
		date,
		durationMinutes: Number(durationMinutes),
		description: description || null,
		startTime: startTime || null,
		endTime: endTime || null,
		isDraft: false
	});

	// Reconcile wiki-link references in description
	if (description) {
		const desiredLinks = extractDescriptionLinks(description);

		for (const link of desiredLinks) {
			try {
				await linkTimeEntryToNote(link.noteId, entry.id, link.headingAnchor);
			} catch {
				// Silently ignore if note doesn't exist
			}
		}
	}

	return json({ success: true, entry }, { status: 201 });
};
