/**
 * Human wording for "what does this delete touch?" in the admin confirm dialogs (sprint 026-CL).
 * Kept free of server imports so components and tests can use it.
 */

export interface UsageSummaryInput {
	timeEntryCount: number;
	totalMinutes: number;
	noteCount?: number;
	contractCount?: number;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** 285 → "4h 45m", 60 → "1h", 30 → "30m". */
export function formatMinutes(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours === 0) return `${minutes}m`;
	return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** "2 contracts, 3 time entries (4h 45m) and 1 note" — or "" when nothing is in use. */
export function describeUsage(usage: UsageSummaryInput): string {
	const parts: string[] = [];
	if (usage.contractCount) parts.push(plural(usage.contractCount, 'contract'));
	if (usage.timeEntryCount) {
		parts.push(`${plural(usage.timeEntryCount, 'time entry', 'time entries')} (${formatMinutes(usage.totalMinutes)})`);
	}
	if (usage.noteCount) parts.push(plural(usage.noteCount, 'note'));
	if (parts.length <= 1) return parts.join('');
	return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** True when deleting would touch entries or notes, so Archive must be offered first. */
export function hasRecordedWork(usage: UsageSummaryInput): boolean {
	return usage.timeEntryCount > 0 || (usage.noteCount ?? 0) > 0;
}
