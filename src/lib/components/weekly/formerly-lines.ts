/**
 * A time entry keeps a "Formerly: …" line when its contract, deliverable or work type is deleted
 * (sprint 026-CL, `appendFormerlyLine`). Cards show those lines apart from the description,
 * as a muted line of their own, so they never read as part of what was worked on.
 */
export type SplitDescription = {
	/** The description without its "Formerly" lines */
	body: string;
	/** Each "Formerly: …" line, in order, trimmed */
	formerlyLines: string[];
};

export const FORMERLY_LINE_PATTERN = /^\s*Formerly: .+$/;

export function splitFormerlyLines(description: string | null | undefined): SplitDescription {
	const formerlyLines: string[] = [];
	const bodyLines: string[] = [];
	for (const line of (description ?? '').split(/\r?\n/)) {
		if (FORMERLY_LINE_PATTERN.test(line)) formerlyLines.push(line.trim());
		else bodyLines.push(line);
	}
	return { body: bodyLines.join('\n').trim(), formerlyLines };
}
