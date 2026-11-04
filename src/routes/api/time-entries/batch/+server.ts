import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { batchResponse, readBatchBody, runBatch } from '$lib/server/batch/run-batch';
import { processEntryItem } from './entry-batch-item';

const MAX_ENTRY_BATCH_ITEMS = 500;

/**
 * POST /api/time-entries/batch  (sprint 038-CL: importing history)
 *
 * Body `{ items: [...], atomic?: boolean }`, at most 500 items, each with the fields of
 * `POST /api/time-entries`: `{ contractId, date, duration | durationMinutes | startTime+endTime,
 * description?, deliverableId?, workTypeId?, noteId? }`, checked the same way (contract,
 * deliverable and work type through `assertEntryReferences`).
 *
 * 200 `{ results: [{ index, ok, id?, updatedAt?, error?, code? }], created, updated, failed }`.
 * With `atomic: true` the first failure rolls every item back; the others report
 * `batch_rolled_back`. A malformed body or too many items is a 400 (`too_many_items`).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const batch = readBatchBody(parsedBody.body, MAX_ENTRY_BATCH_ITEMS);
	if (batch instanceof Response) return batch;

	return batchResponse(await runBatch(batch.items, batch.atomic, processEntryItem({ userId: currentUser.id })));
};
