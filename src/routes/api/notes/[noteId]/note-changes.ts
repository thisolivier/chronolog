/**
 * Shared body of `PUT` and `PATCH /api/notes/[noteId]`: read and check the fields, check the
 * target contract is the caller's, update with the optimistic-concurrency check, refresh the
 * wiki-link index when the markdown changed.
 */
import { json, error } from '@sveltejs/kit';
import { updateNoteForUser, NoteConflictError } from '$lib/server/db/queries/notes';
import { updateNoteLinks } from '$lib/server/db/queries/note-links';
import { contractBelongsToUser } from '$lib/server/db/queries/contracts';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface NoteChangeBody {
	title?: string;
	content?: string;
	contentJson?: string | null;
	contractId?: string;
	expectedUpdatedAt?: string;
}

export async function applyNoteChanges(
	request: Request,
	userId: string,
	noteId: string,
	options: { requireExpectedUpdatedAt: boolean }
): Promise<Response> {
	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { title, content, contentJson, contractId, expectedUpdatedAt } = parsedBody.body as NoteChangeBody;
	for (const [fieldName, value] of Object.entries({ title, content, contentJson, contractId, expectedUpdatedAt })) {
		if (value !== undefined && value !== null && typeof value !== 'string') {
			return apiError(400, `${fieldName} must be text`, 'bad_request');
		}
	}

	let expectedDate: Date | undefined;
	if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null) {
		expectedDate = new Date(expectedUpdatedAt);
		if (Number.isNaN(expectedDate.getTime())) throw error(400, 'Invalid expectedUpdatedAt');
	} else if (options.requireExpectedUpdatedAt) {
		return apiError(400, 'expectedUpdatedAt is required: send the updatedAt of the copy you read', 'expected_updated_at_required');
	}

	if (contractId !== undefined && contractId !== null) {
		if (!UUID_PATTERN.test(contractId)) return apiError(400, 'contractId must be a UUID', 'invalid_contract');
		if (!(await contractBelongsToUser(contractId, userId))) {
			return apiError(403, 'That contract does not belong to you', 'contract_forbidden');
		}
	}

	let note;
	try {
		note = await updateNoteForUser(
			userId,
			noteId,
			// null title or content clears it, as before (the query encrypts null as null)
			title as string | undefined,
			content as string | undefined,
			contentJson,
			contractId ?? undefined,
			expectedDate
		);
	} catch (updateError) {
		if (updateError instanceof NoteConflictError) {
			return json(
				{ error: 'conflict', updatedAt: updateError.currentUpdatedAt.toISOString() },
				{ status: 409 }
			);
		}
		throw updateError;
	}

	if (!note) throw error(404, 'Note not found');

	// Update backlinks index from wiki-links in content (also when emptied, to drop old links)
	if (typeof content === 'string') {
		await updateNoteLinks(noteId, content);
	}

	return json({ note });
}
