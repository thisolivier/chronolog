import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listNotesForContract, createNoteForUser, extractPreviewLines } from '$lib/server/db/queries/notes';

/**
 * GET /api/notes?contractId=X
 *
 * Lists notes for a contract.
 * Returns notes sorted by pinned first, then by updatedAt desc.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractId = url.searchParams.get('contractId');
	if (!contractId) {
		throw error(400, 'contractId is required');
	}

	const notesList = await listNotesForContract(currentUser.id, contractId);

	// Return only the fields needed for the list view
	const notes = notesList.map((note) => {
		const preview = extractPreviewLines(note.contentJson);
		return {
			id: note.id,
			contractId: note.contractId,
			isPinned: note.isPinned,
			createdAt: note.createdAt,
			updatedAt: note.updatedAt,
			firstLine: preview.firstLine,
			secondLine: preview.secondLine
		};
	});

	return json({ notes });
};

/**
 * POST /api/notes
 *
 * Creates a new note with auto-generated ID.
 * Body: { contractId, title?, content?, contentJson? }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { contractId, title, content, contentJson } = body;

	if (!contractId) {
		throw error(400, 'contractId is required');
	}

	const note = await createNoteForUser(
		currentUser.id,
		contractId,
		title,
		content,
		contentJson
	);

	return json({ note }, { status: 201 });
};
