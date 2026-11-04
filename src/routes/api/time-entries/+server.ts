import { json } from '@sveltejs/kit';
import { createTimeEntry, listTimeEntriesInRange } from '$lib/server/db/queries/time-entries';
import { getNoteForUser, linkTimeEntryToNote } from '$lib/server/db/queries/notes';
import { extractDescriptionLinks } from '$lib/utils/reconcile-description-links';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { entryReferenceProblem, isValidDate, readDurationFields, UUID_PATTERN } from './entry-input';
import type { RequestHandler } from './$types';

const MAX_RANGE_DAYS = 366;

/**
 * GET /api/time-entries?from=YYYY-MM-DD&to=YYYY-MM-DD[&contractId=]
 *
 * Non-draft entries in an inclusive date range (at most 366 days), with contract, client,
 * deliverable and work type names. For machine clients; the UI uses the week-shaped endpoints.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const fromDate = url.searchParams.get('from');
	const toDate = url.searchParams.get('to');
	if (!isValidDate(fromDate) || !isValidDate(toDate)) {
		return apiError(400, 'from and to are required as YYYY-MM-DD', 'invalid_range');
	}
	const rangeDays = (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000;
	if (rangeDays < 0 || rangeDays >= MAX_RANGE_DAYS) {
		return apiError(400, `to must be on or after from, and the range at most ${MAX_RANGE_DAYS} days`, 'invalid_range');
	}
	const contractId = url.searchParams.get('contractId') ?? undefined;
	if (contractId !== undefined && !UUID_PATTERN.test(contractId)) {
		return apiError(400, 'contractId must be a UUID', 'invalid_contract');
	}

	const entries = await listTimeEntriesInRange(currentUser.id, fromDate, toDate, contractId);
	const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
	return json({ from: fromDate, to: toDate, totalMinutes, entries });
};

/**
 * POST /api/time-entries — create a manual time entry.
 *
 * Body: `{ date, contractId, durationMinutes | duration, deliverableId?, workTypeId?, description?,
 * startTime?, endTime?, noteId? }`. `duration` takes the same text as the UI's time fields
 * (`1h30m`, `1.5`, `1:30`, `90m`, `9:00-10:30`; a range also sets start and end times).
 * `noteId` links the entry to a note by appending `[[noteId]]` to the description, which is how
 * the UI records entry–note links; an unknown note is a 404 and nothing is created.
 * A contract that is not the caller's is a 403 `contract_forbidden`; a deliverable not on that
 * contract is a 400 `deliverable_mismatch`, a work type not under that deliverable (or given
 * without one) a 400 `work_type_mismatch`.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const { date, contractId, noteId } = body;
	const deliverableId = typeof body.deliverableId === 'string' && body.deliverableId ? body.deliverableId : null;
	const workTypeId = typeof body.workTypeId === 'string' && body.workTypeId ? body.workTypeId : null;
	let description = typeof body.description === 'string' ? body.description : '';

	const durationFields = readDurationFields(body);
	if (durationFields instanceof Response) return durationFields;

	if (!date || !durationFields || !contractId) {
		return apiError(400, 'Missing required fields: date, durationMinutes (or duration), contractId');
	}
	if (!isValidDate(date)) return apiError(400, 'date must be YYYY-MM-DD', 'invalid_date');
	if (typeof contractId !== 'string') return apiError(400, 'contractId must be a UUID', 'invalid_contract');
	const referenceProblem = await entryReferenceProblem({ userId: currentUser.id, contractId, deliverableId, workTypeId });
	if (referenceProblem) return referenceProblem;

	if (noteId !== undefined && noteId !== null && noteId !== '') {
		const note = await getNoteForUser(String(noteId), currentUser.id);
		if (!note) return apiError(404, `Note ${noteId} not found`, 'note_not_found');
		const reference = `[[${note.id}]]`;
		if (!description.includes(reference)) {
			description = description ? `${description} ${reference}` : reference;
		}
	}

	const startTime = (typeof body.startTime === 'string' && body.startTime) || durationFields.startTime || null;
	const endTime = (typeof body.endTime === 'string' && body.endTime) || durationFields.endTime || null;

	const entry = await createTimeEntry({
		userId: currentUser.id,
		contractId,
		deliverableId,
		workTypeId,
		date,
		durationMinutes: durationFields.durationMinutes,
		description: description || null,
		startTime,
		endTime,
		isDraft: false
	});

	// Reconcile wiki-link references in description
	for (const link of extractDescriptionLinks(description)) {
		try {
			await linkTimeEntryToNote(link.noteId, entry.id, link.headingAnchor);
		} catch {
			// Silently ignore if note doesn't exist
		}
	}

	return json({ success: true, entry }, { status: 201 });
};
