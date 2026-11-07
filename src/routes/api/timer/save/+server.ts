import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveDraftTimer } from '$lib/server/db/queries/timer-draft';
import { apiError } from '$lib/server/api-errors';
import { validateDurationMinutes } from '$lib/utils/duration';
import { readLocalTime } from '../local-clock';
import { readJsonObject } from '$lib/server/api-request';
import { entryReferenceProblem } from '../../time-entries/entry-input';
import { readExpectedStart } from '../expected-start';

/**
 * POST /api/timer/save — `{ entryId, contractId, deliverableId?, workTypeId?, description?,
 * durationMinutes?, startTime?, endTime?, expectedStartedAt? }`: the draft becomes a saved entry.
 * Since sprint 056-DR: 409 `not_a_draft` when it was already saved or discarded (a stale device
 * can no longer overwrite it), 409 `timer_changed` when `expectedStartedAt` (optional,
 * `YYYY-MM-DDTHH:MM[:SS]`) is not the draft's start, and the description's `[[links]]` are linked.
 */
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
	const expectedStart = readExpectedStart(body.expectedStartedAt);
	if (expectedStart instanceof Response) return expectedStart;
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

	const saved = await saveDraftTimer(
		entryId,
		currentUser.id,
		{
			...adjustedTime,
			contractId,
			deliverableId: (deliverableId as string | null) || null,
			workTypeId: (workTypeId as string | null) || null,
			description: (description as string | null) || null
		},
		expectedStart
	);
	if (!saved.ok) return apiError(saved.status, saved.status === 404 ? 'Time entry not found' : saved.message, saved.code);

	return json(saved.entry);
};
