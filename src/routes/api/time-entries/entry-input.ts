/**
 * Input checks shared by `POST /api/time-entries` and `PUT`/`PATCH /api/time-entries/[id]`
 * (sprint 029-CL): date and UUID formats, the `duration` text the UI's fields accept, and the
 * rule that an entry's contract belongs to the caller and its deliverable to that contract.
 */

import { apiError } from '$lib/server/api-errors';
import { contractBelongsToUser } from '$lib/server/db/queries/contracts';
import { getDeliverable } from '$lib/server/db/queries/deliverables';
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

/** 403 when the contract is not the caller's; 400 when the deliverable is not on that contract. */
export async function checkContractAccess(
	userId: string,
	contractId: string,
	deliverableId?: string | null
): Promise<Response | null> {
	if (!UUID_PATTERN.test(contractId)) return apiError(400, 'contractId must be a UUID', 'invalid_contract');
	if (!(await contractBelongsToUser(contractId, userId))) {
		return apiError(403, 'That contract does not belong to you', 'contract_forbidden');
	}
	if (deliverableId) {
		const deliverable = UUID_PATTERN.test(deliverableId) ? await getDeliverable(deliverableId, contractId) : null;
		if (!deliverable) return apiError(400, 'That deliverable is not on this contract', 'invalid_deliverable');
	}
	return null;
}
