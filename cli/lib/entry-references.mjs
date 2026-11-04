/**
 * Deliverable and work type references for an entry (`log`, `edit`; sprint 032-CL). A work type
 * is only ever looked for under the entry's deliverable, so one from another deliverable is an
 * unknown reference (exit 3) listing that deliverable's work types, never a guess.
 */

import { ReferenceError_, resolveDeliverable, resolveWorkType } from './resolve.mjs';

export const CLEAR_WORDS = new Set(['none', '-', '']);

export function isClearWord(value) {
	return CLEAR_WORDS.has(String(value).trim().toLowerCase());
}

/** One of the contract's deliverables, from a name or id. */
export async function resolveEntryDeliverable(api, contractId, reference) {
	const deliverables = await api.get(`/api/deliverables?contractId=${contractId}`);
	return resolveDeliverable(reference, deliverables);
}

/** One of `deliverable`'s work types (`deliverable` is `{ id, name }`). */
export async function resolveEntryWorkType(api, deliverable, reference) {
	const workTypes = await api.get(`/api/work-types?deliverableId=${deliverable.id}`);
	try {
		return resolveWorkType(reference, workTypes);
	} catch (failure) {
		if (failure instanceof ReferenceError_ && failure.code === 'not_found') {
			failure.message = workTypes.length
				? `No work type matches “${reference}” under deliverable “${deliverable.name}”.`
				: `Deliverable “${deliverable.name}” has no work types, so “${reference}” cannot be one of them.`;
		}
		throw failure;
	}
}
