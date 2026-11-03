import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listNotesForUser, createNoteForUser, extractPreviewLines } from '$lib/server/db/queries/notes';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';
import { noteDisplayTitle } from '$lib/utils/note-display-title';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject, readRequestTimezone } from '$lib/server/api-request';
import { contractBelongsToUser } from '$lib/server/db/queries/contracts';

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
 * Creates a new note with auto-generated ID (`SHORTCODE.YYYYMMDD.SEQ`, the date in the caller's
 * timezone from `X-Timezone` or `?tz=`, as for `GET /api/me`). 403 when the contract is not the
 * caller's. Body: { contractId, title?, content?, contentJson? } — `content` is markdown.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { contractId, title, content, contentJson } = parsedBody.body;

	if (!contractId) return apiError(400, 'contractId is required');
	if (typeof contractId !== 'string' || !UUID_PATTERN.test(contractId)) {
		return apiError(400, 'contractId must be a UUID', 'invalid_contract');
	}
	for (const [fieldName, value] of Object.entries({ title, content, contentJson })) {
		if (value !== undefined && value !== null && typeof value !== 'string') {
			return apiError(400, `${fieldName} must be text`, 'bad_request');
		}
	}
	if (!(await contractBelongsToUser(contractId, currentUser.id))) {
		return apiError(403, 'That contract does not belong to you', 'contract_forbidden');
	}

	const timezoneResult = readRequestTimezone(url, request);
	if (!timezoneResult.ok) return timezoneResult.response;

	const note = await createNoteForUser(
		currentUser.id,
		contractId,
		(title as string | null) ?? undefined,
		(content as string | null) ?? undefined,
		(contentJson as string | null) ?? undefined,
		{ timezone: timezoneResult.timezone }
	);

	return json({ note }, { status: 201 });
};
