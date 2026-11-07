import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject, readRequestTimezone } from '$lib/server/api-request';
import { getTimeEntryForUser } from '$lib/server/db/queries/time-entries';
import { splitDraftTimer } from '$lib/server/db/queries/timer-split';
import { entryReferenceProblem } from '../../time-entries/entry-input';
import { readSplitRequest } from '../split-request';
import { draftEndMoment, draftStartMoment, splitBoundaryProblem } from '../timer-moments';
import { localMomentInTimezone } from '../timer-start-rules';

/**
 * POST /api/timer/split (sprint 056-DR) — split the live draft timer at `boundary`, in one
 * transaction: the left part is saved as an entry or discarded, and the draft advances to the
 * right part. Body:
 * `{ entryId, expectedStartedAt: "YYYY-MM-DDTHH:MM[:SS]", boundary: "YYYY-MM-DDTHH:MM[:SS]",
 *    clientRequestId, left: { action: "save", contractId, deliverableId?, workTypeId?, description? } | { action: "discard" },
 *    right?: { contractId?, deliverableId?, workTypeId?, description? } }`.
 * A right part with a contract stays the server draft (running or stopped as before); without one
 * the draft is deleted and `remainder.kind` is `pending`: the browser keeps that part as its
 * pending timer from the boundary (with the source's end, if it was stopped).
 * 200 `{ replayed, left: { action: "saved", entry } | { action: "discarded", date, startTime, endTime },
 *        remainder: { kind: "draft", timer } | { kind: "pending", date, startTime, description } | { kind: "gone" } }`.
 * Errors (nothing written): 400 `invalid_split` / `invalid_boundary` / `invalid_client_request_id` /
 * `contract_required` / `boundary_outside` / `interval_too_long`, the reference errors of every
 * entry write (403 `contract_forbidden`, 400 `deliverable_mismatch` / `work_type_mismatch`),
 * 404 `not_found`, 409 `not_a_draft` (saved or discarded elsewhere), 409 `timer_changed`
 * (the draft's start is not `expectedStartedAt`).
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const parsed = readSplitRequest(parsedBody.body);
	if (!parsed.ok) return apiError(400, parsed.problem.message, parsed.problem.code);
	const splitRequest = parsed.request;

	const timezoneResult = readRequestTimezone(url, request);
	if (!timezoneResult.ok) return timezoneResult.response;
	const now = localMomentInTimezone(new Date(), timezoneResult.timezone);

	// One validation on every write path (sprint 032-CL)
	for (const content of [splitRequest.left.action === 'save' ? splitRequest.left : null, splitRequest.right.kind === 'draft' ? splitRequest.right.content : null]) {
		if (!content) continue;
		const referenceProblem = await entryReferenceProblem({ userId: currentUser.id, ...content });
		if (referenceProblem) return referenceProblem;
	}

	const outcome = await splitDraftTimer(currentUser.id, splitRequest, (draft) => {
		const start = draftStartMoment(draft);
		if (!start) return { code: 'timer_changed', message: 'The timer has no start time' };
		return splitBoundaryProblem({ start, end: draftEndMoment(draft), now, boundary: splitRequest.boundary });
	});
	if (!outcome.ok) return apiError(outcome.status, outcome.message, outcome.code);

	const remainder =
		outcome.remainder.kind === 'draft'
			? { kind: 'draft' as const, timer: await getTimeEntryForUser(outcome.remainder.timerId, currentUser.id) }
			: outcome.remainder;
	return json({ replayed: outcome.replayed, left: outcome.left, remainder });
};
