/**
 * Input checks shared by `POST /api/time-entries` and `PUT`/`PATCH /api/time-entries/[id]`
 * (sprint 029-CL): date and UUID formats, the `duration` text the UI's fields accept, and (sprint
 * 032-CL) the one reference rule: contract is the caller's, deliverable on that contract, work type
 * under that deliverable (`$lib/server/db/queries/entry-references.ts`).
 */

import { apiError } from '$lib/server/api-errors';
import {
	assertEntryReferences,
	EntryReferenceError,
	type EntryReferences
} from '$lib/server/db/queries/entry-references';
import { parseDuration, validateDurationMinutes } from '$lib/utils/duration';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDate(value: unknown): value is string {
	return typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export type DurationFields = { durationMinutes: number; startTime?: string; endTime?: string };

/**
 * `durationMinutes` (a whole number) or `duration` text (`1h30m`, `1.5`, `9:00-10:30`; a range
 * also gives start and end times). Null when the body has neither; a Response on bad input.
 */
export function readDurationFields(body: Record<string, unknown>): DurationFields | Response | null {
	if (body.durationMinutes !== undefined) {
		const durationMinutes = Number(body.durationMinutes);
		const durationError = validateDurationMinutes(durationMinutes);
		if (durationError) return apiError(400, durationError, 'invalid_duration');
		return { durationMinutes };
	}
	if (body.duration === undefined) return null;
	if (typeof body.duration !== 'string') return apiError(400, 'duration must be text such as 1h30m', 'invalid_duration');
	const parsed = parseDuration(body.duration);
	if (!parsed.ok) return apiError(400, parsed.error, 'invalid_duration');
	if (parsed.kind === 'range') {
		return { durationMinutes: parsed.durationMinutes, startTime: parsed.startTime, endTime: parsed.endTime };
	}
	return { durationMinutes: parsed.durationMinutes };
}

/**
 * `assertEntryReferences` as a Response: 400 `invalid_contract`, 403 `contract_forbidden`, 400
 * `deliverable_mismatch` or 400 `work_type_mismatch` with a message naming both objects; null when
 * the contract, deliverable and work type agree. Every entry write path calls this.
 */
export async function entryReferenceProblem(references: EntryReferences): Promise<Response | null> {
	try {
		await assertEntryReferences(references);
		return null;
	} catch (failure) {
		if (failure instanceof EntryReferenceError) return apiError(failure.status, failure.message, failure.code);
		throw failure;
	}
}
