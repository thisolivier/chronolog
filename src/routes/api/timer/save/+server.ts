import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateTimeEntry } from '$lib/server/db/queries/time-entries';
import { validateDurationMinutes } from '$lib/utils/duration';
import { readLocalTime } from '../local-clock';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { entryId, contractId, deliverableId, workTypeId, description } = body;

	if (!entryId) {
		throw error(400, 'entryId is required');
	}
	if (!contractId) {
		throw error(400, 'contractId is required to save a time entry');
	}

	// Optional adjustment from the completion form: a new duration, with or without a range
	const adjustedTime: { durationMinutes?: number; startTime?: string | null; endTime?: string | null } = {};
	if (body.durationMinutes !== undefined) {
		const durationError = validateDurationMinutes(body.durationMinutes);
		if (durationError) throw error(400, durationError);
		adjustedTime.durationMinutes = body.durationMinutes;
		adjustedTime.startTime = readLocalTime(body.startTime) ?? null;
		adjustedTime.endTime = readLocalTime(body.endTime) ?? null;
	}

	const savedEntry = await updateTimeEntry(entryId, currentUser.id, {
		...adjustedTime,
		contractId,
		deliverableId: deliverableId || null,
		workTypeId: workTypeId || null,
		description: description || null,
		isDraft: false
	});

	if (!savedEntry) {
		throw error(404, 'Time entry not found');
	}

	return json(savedEntry);
};
