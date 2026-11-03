/**
 * The "Formerly: …" line a time entry keeps when its contract, deliverable or work type is
 * deleted (sprint 026-CL). Appended on a new line so the original description stays intact.
 */
export function appendFormerlyLine(description: string | null, formerLabel: string): string {
	const formerlyLine = `Formerly: ${formerLabel}`;
	const existing = description?.trimEnd() ?? '';
	return existing === '' ? formerlyLine : `${existing}\n${formerlyLine}`;
}
