import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readJsonObject, readRequestTimezone } from '$lib/server/api-request';
import { batchResponse, readBatchBody, runBatch } from '$lib/server/batch/run-batch';
import { processNoteItem } from './note-batch-item';

const MAX_NOTE_BATCH_ITEMS = 200;

/**
 * POST /api/notes/batch  (sprint 038-CL: importing history)
 *
 * Body `{ items: [...], atomic?: boolean }`, at most 200 items, each either
 * - a create `{ contractId, title?, content?, createdAt? }` with the rules of `POST /api/notes`
 *   (`createdAt` backdates in the caller's timezone, `X-Timezone` / `?tz=`), or
 * - an update `{ id, title?, content?, append?, expectedUpdatedAt? }` with the rules of
 *   `PATCH /api/notes/[noteId]`; `append` adds a blank line and the text. Without
 *   `expectedUpdatedAt` the update is applied whatever the note's state, and its result carries
 *   `unconditional: true`.
 *
 * 200 `{ results: [{ index, ok, id?, updatedAt?, error?, code? }], created, updated, failed }`.
 * Items are independent unless `atomic: true`: then the first failure rolls every item back, and
 * the others report `batch_rolled_back`. A malformed body or too many items is a 400 for the whole
 * request (`too_many_items`).
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const batch = readBatchBody(parsedBody.body, MAX_NOTE_BATCH_ITEMS);
	if (batch instanceof Response) return batch;
	const timezoneResult = readRequestTimezone(url, request);
	if (!timezoneResult.ok) return timezoneResult.response;

	const summary = await runBatch(
		batch.items,
		batch.atomic,
		processNoteItem({ userId: currentUser.id, timezone: timezoneResult.timezone })
	);
	return batchResponse(summary);
};
