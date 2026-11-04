import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listNotesForUser } from '$lib/server/db/queries/notes';
import { extractTaskItems } from '$lib/utils/task-items';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';
import { apiError } from '$lib/server/api-errors';
import { isUuid } from '$lib/utils/uuid';

/**
 * GET /api/notes/todos[?contractId=X][&all=1]   (sprint 040-CL)
 *
 * Checkbox task items (`- [ ]` / `- [x]`) across the user's notes, read from each note's decrypted
 * markdown (`extractTaskItems`; the markdown is saved with every edit, so it is never stale).
 * Open items only unless `all=1`. Notes without matching items are left out; trashed notes are
 * never read. Order: pinned first, then most recently changed (as `GET /api/notes`).
 *
 * `{ notes: [{ id, contractId, title, updatedAt, items: [{ text, checked, depth, line }] }],
 *    openCount, doneCount }` — the counts cover the notes returned.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractId = url.searchParams.get('contractId') ?? undefined;
	if (contractId && !isUuid(contractId)) {
		return apiError(400, 'contractId must be a UUID', 'invalid_contract');
	}
	const includeDone = url.searchParams.get('all') === '1' || url.searchParams.get('all') === 'true';

	const notesList = await listNotesForUser(currentUser.id, { contractId });
	let openCount = 0;
	let doneCount = 0;
	const notes = [];
	for (const note of notesList) {
		const items = extractTaskItems(note.content).filter((item) => includeDone || !item.checked);
		if (!items.length) continue;
		for (const item of items) {
			if (item.checked) doneCount += 1;
			else openCount += 1;
		}
		notes.push({
			id: note.id,
			contractId: note.contractId,
			title: noteDisplayTitle(note.title, note.contentJson) ?? (extractMarkdownPreviewLines(note.content).firstLine || null),
			updatedAt: note.updatedAt,
			items
		});
	}
	return json({ notes, openCount, doneCount });
};
