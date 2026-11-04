/**
 * Small helpers shared by the admin form actions (sprint 026-CL): specific error wording and
 * the "what moved where" success messages.
 */
import { error } from '@sveltejs/kit';
import { describeUsage } from '$lib/utils/usage-summary';
import type { DeletionResult } from '$lib/server/db/queries/safe-deletion';
import { isUuid } from '$lib/utils/uuid';

/**
 * Postgres unique-constraint violation (code 23505). Drizzle wraps the driver error in a
 * `DrizzleQueryError` whose message is just "Failed query: …", so walk the `cause` chain.
 */
export function isUniqueViolation(databaseError: unknown): boolean {
	let current: unknown = databaseError;
	for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
		if ((current as Error & { code?: string }).code === '23505') return true;
		if (current.message.includes('duplicate key value violates unique constraint')) return true;
		current = current.cause;
	}
	return false;
}

export function requireUser(locals: App.Locals) {
	if (!locals.user) throw error(401, 'Unauthorized');
	return locals.user;
}

/** A uuid form field, or `null` when missing or malformed (so Postgres never sees it). */
export function readUuidField(formData: FormData, fieldName: string): string | null {
	const value = formData.get(fieldName)?.toString();
	return isUuid(value) ? value : null;
}

export function duplicateShortCodeMessage(shortCode: string): string {
	return `Short code “${shortCode}” is already used by another client. Pick a different one.`;
}

/** e.g. Deleted “Rocket Build”. 3 time entries (4h 45m) and 2 notes moved to Deleted Client / Deleted Contract. */
export function deletionMessage(
	name: string,
	result: DeletionResult,
	minutesMoved = 0
): string {
	const moved = describeUsage({
		timeEntryCount: result.reassignedTimeEntryCount,
		totalMinutes: minutesMoved,
		noteCount: result.movedNoteCount
	});
	return moved
		? `Deleted “${name}”. ${moved.charAt(0).toUpperCase()}${moved.slice(1)} moved to Deleted Client / Deleted Contract, each entry noting where it came from.`
		: `Deleted “${name}”.`;
}

export function archiveMessage(kind: 'client' | 'contract', name: string, archived: boolean): string {
	return archived
		? `Archived ${kind} “${name}”. It is hidden from the sidebar and selects; its entries and notes are kept.`
		: `Restored ${kind} “${name}”. It is back in the sidebar and selects.`;
}

/** e.g. ` 3 time entries keep “Formerly: Phase 2” in the description.` (empty when none). */
export function entriesKeptMessage(count: number, formerName: string): string {
	if (count === 0) return '';
	const entries = count === 1 ? '1 time entry keeps' : `${count} time entries keep`;
	return ` ${entries} “Formerly: ${formerName}” in the description.`;
}
