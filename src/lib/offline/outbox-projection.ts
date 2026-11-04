/**
 * What the screen shows while writes are queued (sprint 045-CL): the server copy (fresh or
 * cached) with the queued items laid over it. Reads always go through this, online too, so a
 * held or not-yet-replayed change never seems to vanish when a fresh server copy arrives.
 */
import type { NoteDetail, NoteSummary, TimeEntryDisplay, WeekData } from '$lib/services/types';
import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
import { extractMarkdownPreviewLines } from '$lib/utils/markdown-preview-lines';
import type { NoteCreateItem, NoteFieldValues, OutboxItem } from './outbox-types';

export function previewLines(fields: NoteFieldValues): { firstLine: string; secondLine: string } {
	return fields.contentJson
		? extractPreviewLines(fields.contentJson)
		: extractMarkdownPreviewLines(fields.content ?? null);
}

function countWords(markdown: string | undefined): number {
	return (markdown ?? '').split(/\s+/).filter(Boolean).length;
}

/** The queued note (offline create) under its temp or real ID */
export function findQueuedNoteCreate(items: OutboxItem[], noteId: string): NoteCreateItem | undefined {
	return items.find(
		(item): item is NoteCreateItem => item.kind === 'note-create' && (item.tempId === noteId || item.realId === noteId)
	);
}

function queuedNoteFields(items: OutboxItem[], noteId: string): NoteFieldValues | null {
	for (const item of items) {
		if (item.kind === 'note-update' && item.noteId === noteId) return item.changes;
		if (item.kind === 'note-create' && (item.tempId === noteId || item.realId === noteId)) return item.fields;
	}
	return null;
}

/** A note made offline, as the editor loads it. Its `updatedAt` is the time it was queued. */
export function noteDetailFromCreate(item: NoteCreateItem): NoteDetail {
	return {
		id: item.realId ?? item.tempId,
		title: item.fields.title ?? null,
		content: item.fields.content ?? null,
		contentJson: item.fields.contentJson ?? null,
		contractId: item.contractId,
		wordCount: countWords(item.fields.content),
		isPinned: false,
		pinnedAt: null,
		createdAt: item.queuedAt,
		updatedAt: item.realUpdatedAt ?? item.queuedAt
	};
}

export function projectNoteDetail(note: NoteDetail, items: OutboxItem[]): NoteDetail {
	const fields = queuedNoteFields(items, note.id);
	if (!fields) return note;
	return {
		...note,
		...fields,
		wordCount: fields.content !== undefined ? countWords(fields.content) : note.wordCount
	};
}

function summaryFromCreate(item: NoteCreateItem): NoteSummary {
	return {
		id: item.realId ?? item.tempId,
		contractId: item.contractId,
		isPinned: false,
		pinnedAt: null,
		createdAt: item.queuedAt,
		updatedAt: item.queuedAt,
		...previewLines(item.fields)
	};
}

/**
 * A note list with queued edits applied and notes made offline added on top. `includesContract`
 * says which contracts the list covers (one contract, or every contract of a client).
 */
export function projectNoteSummaries(
	notes: NoteSummary[],
	items: OutboxItem[],
	includesContract: (contractId: string) => boolean
): NoteSummary[] {
	const projected = notes.map((note) => {
		const fields = queuedNoteFields(items, note.id);
		if (!fields || (fields.content === undefined && fields.contentJson === undefined)) return note;
		return { ...note, ...previewLines(fields) };
	});
	const listedIds = new Set(projected.map((note) => note.id));
	const created = items
		.filter((item): item is NoteCreateItem => item.kind === 'note-create' && includesContract(item.contractId))
		.filter((item) => !listedIds.has(item.realId ?? item.tempId))
		.map(summaryFromCreate)
		.reverse();
	const firstUnpinned = projected.findIndex((note) => !note.isPinned);
	const insertAt = firstUnpinned === -1 ? projected.length : firstUnpinned;
	return [...projected.slice(0, insertAt), ...created, ...projected.slice(insertAt)];
}

/**
 * Weeks with queued entry creates, edits and deletes applied; totals recomputed. An edited entry
 * keeps its place in its day; one moved to another date, and a new one, go at the end of the day.
 */
export function projectWeeks(weeks: WeekData[], items: OutboxItem[]): WeekData[] {
	const deletedIds = new Set<string>();
	const updatedById = new Map<string, Partial<TimeEntryDisplay>>();
	const created: TimeEntryDisplay[] = [];
	for (const item of items) {
		if (item.kind === 'entry-delete') deletedIds.add(item.entryId);
		else if (item.kind === 'entry-update') updatedById.set(item.entryId, item.displayPatch ?? item.changes);
		else if (item.kind === 'entry-create') created.push(item.display);
	}
	if (deletedIds.size === 0 && updatedById.size === 0 && created.length === 0) return weeks;

	const serverEntries = weeks.flatMap((week) => week.days.flatMap((day) => day.entries));
	const createdIds = new Set(created.map((entry) => entry.id));
	const movedOrCreated = [
		...serverEntries
			.filter((entry) => updatedById.has(entry.id) && !deletedIds.has(entry.id))
			.map((entry) => ({ ...entry, ...updatedById.get(entry.id), id: entry.id }) as TimeEntryDisplay)
			.filter((entry) => !serverEntries.some((original) => original.id === entry.id && original.date === entry.date)),
		...created
	];

	return weeks.map((week) => {
		const days = week.days.map((day) => {
			const kept = day.entries
				.filter((entry) => !deletedIds.has(entry.id) && !createdIds.has(entry.id))
				.map((entry) => (updatedById.has(entry.id) ? ({ ...entry, ...updatedById.get(entry.id), id: entry.id } as TimeEntryDisplay) : entry))
				.filter((entry) => entry.date === day.date);
			const entries = [...kept, ...movedOrCreated.filter((entry) => entry.date === day.date)];
			return { ...day, entries, totalMinutes: entries.reduce((sum, entry) => sum + entry.durationMinutes, 0) };
		});
		return { ...week, days, weeklyTotalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0) };
	});
}
