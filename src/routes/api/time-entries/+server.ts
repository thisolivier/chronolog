import { json } from '@sveltejs/kit';
import { createTimeEntry, listTimeEntriesInRange } from '$lib/server/db/queries/time-entries';
import { getNoteForUser, linkTimeEntryToNote } from '$lib/server/db/queries/notes';
import { extractDescriptionLinks } from '$lib/utils/reconcile-description-links';
import { parseDuration, validateDurationMinutes } from '$lib/utils/duration';
import { apiError } from '$lib/server/api-errors';
import type { RequestHandler } from './$types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RANGE_DAYS = 366;

function isValidDate(value: string | null): value is string {
	return value !== null && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

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
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') return apiError(400, 'Invalid JSON body');
	const { date, contractId, deliverableId, workTypeId, noteId } = body;
	let { durationMinutes, description, startTime, endTime } = body;

	if (typeof body.duration === 'string' && durationMinutes === undefined) {
		const parsedDuration = parseDuration(body.duration);
		if (!parsedDuration.ok) return apiError(400, parsedDuration.error, 'invalid_duration');
		durationMinutes = parsedDuration.durationMinutes;
		if (parsedDuration.kind === 'range') {
			startTime = startTime ?? parsedDuration.startTime;
			endTime = endTime ?? parsedDuration.endTime;
		}
	}

	if (!date || durationMinutes === undefined || !contractId) {
		return apiError(400, 'Missing required fields: date, durationMinutes (or duration), contractId');
	}
	if (!isValidDate(date)) return apiError(400, 'date must be YYYY-MM-DD', 'invalid_date');
	if (!UUID_PATTERN.test(contractId)) return apiError(400, 'contractId must be a UUID', 'invalid_contract');

	const durationError = validateDurationMinutes(Number(durationMinutes));
	if (durationError) return apiError(400, durationError, 'invalid_duration');

	if (noteId !== undefined && noteId !== null && noteId !== '') {
		const note = await getNoteForUser(String(noteId), currentUser.id);
		if (!note) return apiError(404, `Note ${noteId} not found`, 'note_not_found');
		const reference = `[[${note.id}]]`;
		if (!String(description ?? '').includes(reference)) {
			description = description ? `${description} ${reference}` : reference;
		}
	}

	const entry = await createTimeEntry({
		userId: currentUser.id,
		contractId,
		deliverableId: deliverableId || null,
		workTypeId: workTypeId || null,
		date,
		durationMinutes: Number(durationMinutes),
		description: description || null,
		startTime: startTime || null,
		endTime: endTime || null,
		isDraft: false
	});

	// Reconcile wiki-link references in description
	if (description) {
		const desiredLinks = extractDescriptionLinks(description);

		for (const link of desiredLinks) {
			try {
				await linkTimeEntryToNote(link.noteId, entry.id, link.headingAnchor);
			} catch {
				// Silently ignore if note doesn't exist
			}
		}
	}

	return json({ success: true, entry }, { status: 201 });
};
