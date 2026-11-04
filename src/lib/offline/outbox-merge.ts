/**
 * Per-field last-write-wins for a queued edit replayed against the server copy (sprint 045-CL).
 *
 * Fields are compared in groups that must stay together (a note's markdown and its editor JSON;
 * an entry's start, end and duration; its contract, deliverable and work type). For each group the
 * queued edit changed:
 * - the server already has the same value: nothing to send;
 * - the server still has the value the edit was based on: the edit wins;
 * - otherwise the server changed it too: the whole item is held for the user.
 */
import type { TimeEntryFields } from '$lib/services/types';
import type { EntryDeleteItem, EntryUpdateItem, NoteFieldValues, NoteUpdateItem } from './outbox-types';

export type ServerNote = { title: string | null; content: string | null; contentJson: string | null; updatedAt: string };

export type ServerEntry = Partial<Record<keyof TimeEntryFields, unknown>>;

export type ReplayPlan<Body> =
	| { action: 'send'; body: Body }
	| { action: 'nothing-to-send' }
	| { action: 'hold'; conflictFields: string[] };

const NOTE_GROUPS: Record<string, (keyof NoteFieldValues)[]> = {
	title: ['title'],
	content: ['content', 'contentJson']
};

/** Which field of a group is compared (the editor JSON follows the markdown) */
const NOTE_GROUP_KEY: Record<string, keyof NoteFieldValues> = { title: 'title', content: 'content' };

export const ENTRY_GROUPS: Record<string, (keyof TimeEntryFields)[]> = {
	time: ['startTime', 'endTime', 'durationMinutes'],
	date: ['date'],
	description: ['description'],
	references: ['contractId', 'deliverableId', 'workTypeId']
};

function normalise(value: unknown): string {
	if (value === null || value === undefined) return '';
	const text = String(value);
	// Times come back as HH:MM:SS from the server and go out as HH:MM
	return /^\d{2}:\d{2}:\d{2}$/.test(text) ? text.slice(0, 5) : text;
}

function sameValue(first: unknown, second: unknown): boolean {
	return normalise(first) === normalise(second);
}

export function planNoteUpdate(
	item: Pick<NoteUpdateItem, 'baseUpdatedAt' | 'base' | 'changes'>,
	server: ServerNote
): ReplayPlan<NoteFieldValues & { expectedUpdatedAt: string }> {
	const serverUnchanged = item.baseUpdatedAt !== null && item.baseUpdatedAt === server.updatedAt;
	const body: NoteFieldValues = {};
	const conflictFields: string[] = [];
	for (const [group, fields] of Object.entries(NOTE_GROUPS)) {
		const compareField = NOTE_GROUP_KEY[group];
		if (!fields.some((field) => item.changes[field] !== undefined)) continue;
		const mine = item.changes[compareField];
		const serverValue = server[compareField];
		const baseKnown = item.base !== null && item.base[compareField] !== undefined;
		const groupBody = Object.fromEntries(
			fields.filter((field) => item.changes[field] !== undefined).map((field) => [field, item.changes[field]])
		);
		if (mine !== undefined && sameValue(serverValue, mine) && !serverUnchanged) continue;
		if (serverUnchanged || (baseKnown && sameValue(serverValue, item.base?.[compareField]))) {
			Object.assign(body, groupBody);
		} else {
			conflictFields.push(group);
		}
	}
	if (conflictFields.length > 0) return { action: 'hold', conflictFields };
	if (Object.keys(body).length === 0) return { action: 'nothing-to-send' };
	return { action: 'send', body: { ...body, expectedUpdatedAt: server.updatedAt } };
}

export function planEntryUpdate(
	item: Pick<EntryUpdateItem, 'base' | 'changes'>,
	server: ServerEntry
): ReplayPlan<Partial<TimeEntryFields>> {
	const body: Partial<TimeEntryFields> = {};
	const conflictFields: string[] = [];
	for (const [group, fields] of Object.entries(ENTRY_GROUPS)) {
		const changedFields = fields.filter((field) => item.changes[field] !== undefined);
		if (changedFields.length === 0) continue;
		const serverMatchesMine = changedFields.every((field) => sameValue(server[field], item.changes[field]));
		if (serverMatchesMine) continue;
		const baseKnown = item.base !== null && changedFields.every((field) => item.base?.[field] !== undefined);
		const serverMatchesBase = baseKnown && fields.every(
			(field) => item.base?.[field] === undefined || sameValue(server[field], item.base[field])
		);
		if (serverMatchesBase) {
			for (const field of changedFields) Object.assign(body, { [field]: item.changes[field] });
		} else {
			conflictFields.push(group);
		}
	}
	if (conflictFields.length > 0) return { action: 'hold', conflictFields };
	if (Object.keys(body).length === 0) return { action: 'nothing-to-send' };
	return { action: 'send', body };
}

/** Delete unless the server copy was edited since the delete's base (then ask) */
export function planEntryDelete(item: Pick<EntryDeleteItem, 'base'>, server: ServerEntry | null): ReplayPlan<null> {
	if (server === null) return { action: 'nothing-to-send' };
	if (!item.base) return { action: 'send', body: null };
	const conflictFields = Object.entries(ENTRY_GROUPS)
		.filter(([, fields]) =>
			fields.some((field) => item.base?.[field] !== undefined && !sameValue(server[field], item.base[field]))
		)
		.map(([group]) => group);
	return conflictFields.length > 0 ? { action: 'hold', conflictFields } : { action: 'send', body: null };
}
