/**
 * Adding to the outbox (sprint 045-CL). Pure functions over an `OutboxState`; the caller loads
 * and saves it (`outbox-store.svelte.ts`).
 *
 * Folding rules, so the queue keeps one item per resource in the order of its first edit:
 * - an edit of a note or entry created offline goes into its create item;
 * - a later edit of the same note or entry merges into the queued update (the base stays the
 *   oldest known server copy, the changes are the newest);
 * - deleting an entry created offline removes its create item; deleting an entry with a queued
 *   update turns that update into the delete.
 */
import type { CreateTimeEntryInput, TimeEntryDisplay, TimeEntryFields } from '$lib/services/types';
import {
	TEMP_ID_PREFIX,
	type EntryCreateItem,
	type EntryDeleteItem,
	type EntryUpdateItem,
	type NoteCreateItem,
	type NoteFieldValues,
	type NoteUpdateItem,
	type OutboxItem,
	type OutboxState
} from './outbox-types';

export function newTempId(): string {
	const randomPart =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
			: Math.random().toString(16).slice(2, 18).padEnd(16, '0');
	return `${TEMP_ID_PREFIX}${randomPart}`;
}

function nextCommon(state: OutboxState, now: string) {
	const sequence = state.nextSequence;
	state.nextSequence += 1;
	return {
		sequence,
		queuedAt: now,
		revision: 1,
		status: 'pending' as const,
		...(state.ownerUserId ? { ownerUserId: state.ownerUserId } : {})
	};
}

/** The real ID for a temp ID the server has already created, else the ID itself */
export function resolveId(state: OutboxState, id: string): string {
	return state.idMap[id] ?? id;
}

/** Replace every temp ID the server has created in `text` (wiki-links, IDs in JSON) */
export function replaceTempIds(text: string, idMap: Record<string, string>): string {
	if (!text.includes(TEMP_ID_PREFIX)) return text;
	let result = text;
	for (const [tempId, realId] of Object.entries(idMap)) {
		if (result.includes(tempId)) result = result.split(tempId).join(realId);
	}
	return result;
}

/** Temp IDs (`offline-…`) mentioned in a text */
export function tempIdsIn(text: string | null | undefined): string[] {
	if (!text) return [];
	return [...new Set(text.match(new RegExp(`${TEMP_ID_PREFIX}[0-9a-f]{16}`, 'g')) ?? [])];
}

function findNoteCreate(state: OutboxState, noteId: string): NoteCreateItem | undefined {
	return state.items.find(
		(item): item is NoteCreateItem => item.kind === 'note-create' && (item.tempId === noteId || item.realId === noteId)
	);
}

function mergeMissing<Values extends object>(older: Values | null, newer: Values | null): Values | null {
	if (!older) return newer;
	if (!newer) return older;
	return { ...newer, ...older };
}

export function queueNoteCreate(
	state: OutboxState,
	input: { tempId: string; contractId: string; fields: NoteFieldValues; now: string }
): NoteCreateItem {
	const item: NoteCreateItem = {
		...nextCommon(state, input.now),
		kind: 'note-create',
		tempId: input.tempId,
		contractId: input.contractId,
		fields: { ...input.fields }
	};
	state.items.push(item);
	return item;
}

export function queueNoteUpdate(
	state: OutboxState,
	input: { noteId: string; baseUpdatedAt: string | null; base: NoteFieldValues | null; changes: NoteFieldValues; now: string }
): OutboxItem {
	const noteId = resolveId(state, input.noteId);
	const createItem = findNoteCreate(state, noteId);
	if (createItem) {
		createItem.fields = { ...createItem.fields, ...input.changes };
		createItem.revision += 1;
		return createItem;
	}
	const queuedUpdate = state.items.find(
		(item): item is NoteUpdateItem => item.kind === 'note-update' && item.noteId === noteId
	);
	if (queuedUpdate) {
		queuedUpdate.changes = { ...queuedUpdate.changes, ...input.changes };
		queuedUpdate.base = mergeMissing(queuedUpdate.base, input.base);
		queuedUpdate.revision += 1;
		return queuedUpdate;
	}
	const item: NoteUpdateItem = {
		...nextCommon(state, input.now),
		kind: 'note-update',
		noteId,
		baseUpdatedAt: input.baseUpdatedAt,
		base: input.base ? { ...input.base } : null,
		changes: { ...input.changes }
	};
	state.items.push(item);
	return item;
}

export function queueEntryCreate(
	state: OutboxState,
	input: { tempId: string; input: CreateTimeEntryInput; display: TimeEntryDisplay; now: string }
): EntryCreateItem {
	const item: EntryCreateItem = {
		...nextCommon(state, input.now),
		kind: 'entry-create',
		tempId: input.tempId,
		input: { ...input.input },
		display: { ...input.display, id: input.tempId }
	};
	state.items.push(item);
	return item;
}

/** A change to a queued create's input: null clears an optional field */
function applyChangesToCreateInput(input: CreateTimeEntryInput, changes: Partial<TimeEntryFields>): CreateTimeEntryInput {
	const merged: CreateTimeEntryInput = { ...input };
	for (const [field, value] of Object.entries(changes)) {
		if (value === null && (field === 'startTime' || field === 'endTime' || field === 'description')) {
			delete (merged as Record<string, unknown>)[field];
		} else {
			(merged as Record<string, unknown>)[field] = value;
		}
	}
	return merged;
}

export function queueEntryUpdate(
	state: OutboxState,
	input: {
		entryId: string;
		base: Partial<TimeEntryFields> | null;
		changes: Partial<TimeEntryFields>;
		displayPatch?: Partial<TimeEntryDisplay>;
		now: string;
	}
): OutboxItem | null {
	const entryId = resolveId(state, input.entryId);
	const displayPatch = { ...input.changes, ...input.displayPatch };
	for (const item of state.items) {
		if (item.kind === 'entry-create' && item.tempId === entryId) {
			item.input = applyChangesToCreateInput(item.input, input.changes);
			item.display = { ...item.display, ...displayPatch, id: item.tempId };
			item.revision += 1;
			return item;
		}
		if (item.kind === 'entry-delete' && item.entryId === entryId) return null;
		if (item.kind === 'entry-update' && item.entryId === entryId) {
			item.changes = { ...item.changes, ...input.changes };
			item.base = mergeMissing(item.base, input.base);
			item.displayPatch = { ...item.displayPatch, ...displayPatch };
			item.revision += 1;
			return item;
		}
	}
	const item: EntryUpdateItem = {
		...nextCommon(state, input.now),
		kind: 'entry-update',
		entryId,
		base: input.base ? { ...input.base } : null,
		changes: { ...input.changes },
		displayPatch
	};
	state.items.push(item);
	return item;
}

export function queueEntryDelete(
	state: OutboxState,
	input: { entryId: string; base: Partial<TimeEntryFields> | null; date: string | null; now: string }
): OutboxItem | null {
	const entryId = resolveId(state, input.entryId);
	const createIndex = state.items.findIndex((item) => item.kind === 'entry-create' && item.tempId === entryId);
	// A create not yet sent is simply dropped. One being sent right now may already exist on the
	// server: the delete is queued after it, under the temp ID the replay then remaps (review fix 2).
	if (createIndex !== -1 && !state.items[createIndex].inFlight) {
		state.items.splice(createIndex, 1);
		return null;
	}
	const updateIndex = state.items.findIndex((item) => item.kind === 'entry-update' && item.entryId === entryId);
	if (updateIndex !== -1) {
		const queuedUpdate = state.items[updateIndex] as EntryUpdateItem;
		const deleteItem: EntryDeleteItem = {
			sequence: queuedUpdate.sequence,
			queuedAt: queuedUpdate.queuedAt,
			revision: queuedUpdate.revision + 1,
			status: 'pending',
			kind: 'entry-delete',
			entryId,
			base: mergeMissing(queuedUpdate.base, input.base),
			date: input.date
		};
		state.items[updateIndex] = deleteItem;
		return deleteItem;
	}
	if (state.items.some((item) => item.kind === 'entry-delete' && item.entryId === entryId)) return null;
	const item: EntryDeleteItem = {
		...nextCommon(state, input.now),
		kind: 'entry-delete',
		entryId,
		base: input.base ? { ...input.base } : null,
		date: input.date
	};
	state.items.push(item);
	return item;
}

export function removeItem(state: OutboxState, sequence: number): void {
	state.items = state.items.filter((item) => item.sequence !== sequence);
}

function remapText<Value extends string | null | undefined>(value: Value, tempId: string, realId: string): Value {
	return (typeof value === 'string' && value.includes(tempId) ? value.split(tempId).join(realId) : value) as Value;
}

/**
 * The server created `tempId` as `realId`: record it and rewrite every queued item that names
 * it (the item's own ID, wiki-links in note content and entry descriptions).
 */
export function applyIdMapping(state: OutboxState, tempId: string, realId: string): void {
	state.idMap[tempId] = realId;
	for (const item of state.items) {
		switch (item.kind) {
			case 'note-create':
				item.fields = remapNoteFields(item.fields, tempId, realId);
				break;
			case 'note-update':
				if (item.noteId === tempId) item.noteId = realId;
				item.changes = remapNoteFields(item.changes, tempId, realId);
				break;
			case 'entry-create':
				item.input = { ...item.input, description: remapText(item.input.description, tempId, realId) };
				item.display = { ...item.display, description: remapText(item.display.description, tempId, realId) };
				break;
			case 'entry-update':
				if (item.entryId === tempId) item.entryId = realId;
				if (item.changes.description !== undefined) {
					item.changes = { ...item.changes, description: remapText(item.changes.description, tempId, realId) };
				}
				break;
			case 'entry-delete':
				if (item.entryId === tempId) item.entryId = realId;
				break;
		}
	}
}

function remapNoteFields(fields: NoteFieldValues, tempId: string, realId: string): NoteFieldValues {
	return {
		...fields,
		...(fields.title !== undefined ? { title: remapText(fields.title, tempId, realId) } : {}),
		...(fields.content !== undefined ? { content: remapText(fields.content, tempId, realId) } : {}),
		...(fields.contentJson !== undefined ? { contentJson: remapText(fields.contentJson, tempId, realId) } : {})
	};
}
