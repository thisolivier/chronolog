import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { discardDraftTimer } from '$lib/server/db/queries/timer-draft';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';
import { readExpectedStart } from '../expected-start';

/**
 * POST /api/timer/discard — `{ entryId, expectedStartedAt? }` deletes the draft. Since sprint
 * 056-DR only a draft: 409 `not_a_draft` for an entry already saved (a stale device can no longer
 * delete it), 409 `timer_changed` when `expectedStartedAt` is not the draft's start, 404 `not_found`.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const entryId = body.entryId;

	if (!entryId || typeof entryId !== 'string') {
		throw error(400, 'entryId is required');
	}

	const expectedStart = readExpectedStart(body.expectedStartedAt);
	if (expectedStart instanceof Response) return expectedStart;
	const discarded = await discardDraftTimer(entryId, currentUser.id, expectedStart);
	if (!discarded.ok) return apiError(discarded.status, discarded.message, discarded.code);

	return json({ success: true });
};
