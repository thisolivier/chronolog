import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listNotesForUser, createNoteForUser, extractPreviewLines } from '$lib/server/db/queries/notes';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { apiError } from '$lib/server/api-errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/notes[?contractId=X][&updatedSince=ISO-8601]
 *
 * Lists the user's notes (one contract's when `contractId` is given; only those changed after
 * `updatedSince` when given), pinned first, then by updatedAt desc. At least one filter is
 * required. Notes without TipTap JSON (created over the API) preview from their markdown.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const contractId = url.searchParams.get('contractId') ?? undefined;
	const updatedSinceParam = url.searchParams.get('updatedSince');
	if (!contractId && !updatedSinceParam) {
		return apiError(400, 'contractId or updatedSince is required', 'bad_request');
	}
	if (contractId && !UUID_PATTERN.test(contractId)) {
		return apiError(400, 'contractId must be a UUID', 'invalid_contract');
	}
	let updatedSince: Date | undefined;
	if (updatedSinceParam) {
		updatedSince = new Date(updatedSinceParam);
		if (Number.isNaN(updatedSince.getTime())) {
			return apiError(400, 'updatedSince must be an ISO date or date-time', 'invalid_date');
		}
	}

	const notesList = await listNotesForUser(currentUser.id, { contractId, updatedSince });

	// Return only the fields needed for the list view
	const notes = notesList.map((note) => {
		const preview = note.contentJson
			? extractPreviewLines(note.contentJson)
			: extractMarkdownPreviewLines(note.content);
		return {
			id: note.id,
			contractId: note.contractId,
			title: note.title,
			displayTitle: noteDisplayTitle(note.title, note.contentJson) ?? (preview.firstLine || null),
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
 * Body: { contractId, title?, content?, contentJson? } — `content` is markdown.
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
