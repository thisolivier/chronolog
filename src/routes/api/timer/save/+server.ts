import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateTimeEntry } from '$lib/server/db/queries/time-entries';
import { validateDurationMinutes } from '$lib/utils/duration';
import { readLocalTime } from '../local-clock';
import { readJsonObject } from '$lib/server/api-request';
import { entryReferenceProblem } from '../../time-entries/entry-input';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const { entryId, contractId, deliverableId, workTypeId, description } = body;

	if (!entryId || typeof entryId !== 'string') {
		throw error(400, 'entryId is required');
	}
	if (!contractId || typeof contractId !== 'string') {
		throw error(400, 'contractId is required to save a time entry');
	}
	for (const [fieldName, value] of Object.entries({ deliverableId, workTypeId, description })) {
		if (value !== undefined && value !== null && typeof value !== 'string') {
			throw error(400, `${fieldName} must be text`);
		}
	}
	const referenceProblem = await entryReferenceProblem({
		userId: currentUser.id,
		contractId,
		deliverableId: (deliverableId as string | null) || null,
		workTypeId: (workTypeId as string | null) || null
	});
	if (referenceProblem) return referenceProblem;

	// Optional adjustment from the completion form: a new duration, with or without a range
	const adjustedTime: { durationMinutes?: number; startTime?: string | null; endTime?: string | null } = {};
	if (body.durationMinutes !== undefined) {
		const durationError = validateDurationMinutes(body.durationMinutes);
		if (durationError) throw error(400, durationError);
		adjustedTime.durationMinutes = body.durationMinutes as number;
		adjustedTime.startTime = readLocalTime(body.startTime) ?? null;
		adjustedTime.endTime = readLocalTime(body.endTime) ?? null;
	}

	const savedEntry = await updateTimeEntry(entryId, currentUser.id, {
		...adjustedTime,
		contractId,
		deliverableId: (deliverableId as string | null) || null,
		workTypeId: (workTypeId as string | null) || null,
		description: (description as string | null) || null,
		isDraft: false
	});

	if (!savedEntry) {
		throw error(404, 'Time entry not found');
	}

	return json(savedEntry);
};
