import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setNotePinnedForUser } from '$lib/server/db/queries/note-pins';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';

/**
 * PUT /api/notes/[noteId]/pin  (sprint 039-CL)
 *
 * Body `{ pinned: boolean }`. Pins or unpins the caller's note; pinned notes list first, most
 * recently pinned on top. A dedicated route rather than `PATCH /api/notes/[noteId]`: PATCH needs
 * `expectedUpdatedAt` and bumps `updatedAt`, while pinning is not an edit and must not make an
 * open editor's next autosave a conflict. Pinning twice keeps the first `pinnedAt`.
 * Returns `{ note: { id, contractId, isPinned, pinnedAt } }`; 404 `note_not_found` when the note
 * is not the caller's or is in the trash.
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { pinned } = parsedBody.body;
	if (typeof pinned !== 'boolean') return apiError(400, 'pinned must be true or false', 'bad_request');

	const note = await setNotePinnedForUser(currentUser.id, params.noteId, pinned);
	if (!note) return apiError(404, `Note ${params.noteId} not found`, 'note_not_found');
	return json({ note });
};
