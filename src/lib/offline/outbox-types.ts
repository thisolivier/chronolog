/**
 * Shapes of the offline write outbox (sprint 045-CL). Plain data, stored as JSON in
 * localStorage per user (`outbox-storage.ts`), so a write survives a reload or a closed tab.
 *
 * One queued item per resource: later edits of the same note or entry are folded into the item
 * already queued (`outbox-queue.ts`), so the queue stays short and keeps the order of first edit.
 */
import type { CreateTimeEntryInput, TimeEntryDisplay, TimeEntryFields } from '$lib/services/types';

/** Note fields the outbox carries; `content` and `contentJson` always travel together */
export type NoteFieldValues = {
	title?: string;
	content?: string;
	contentJson?: string;
};

/** Why an item is held, waiting for the user (nothing is dropped silently) */
export type HoldInfo = {
	/** `conflict`: the server changed the same field meanwhile; `refused`: the server said no */
	reason: 'conflict' | 'refused';
	message: string;
	/** Field groups changed on both sides (conflict only) */
	conflictFields?: string[];
	/** The server's copy when the item was held, for the prompt's "server" column */
	server?: Record<string, unknown> | null;
	heldAt: string;
};

type ItemCommon = {
	/** Queue position; also the item's identity */
	sequence: number;
	queuedAt: string;
	/** Bumped on every fold, so a replay in flight can tell it sent an older version */
	revision: number;
	status: 'pending' | 'held';
	hold?: HoldInfo;
	/** The account the change was made in; it is only ever sent as that account (review fix 5b) */
	ownerUserId?: string;
	/** Set while a replay's create request for it is on its way (review fix 2) */
	inFlight?: boolean;
};

export type NoteCreateItem = ItemCommon & {
	kind: 'note-create';
	tempId: string;
	contractId: string;
	fields: NoteFieldValues;
	/** Set once the server created the note (replay phase 1); the content follows in phase 2 */
	realId?: string;
	realUpdatedAt?: string;
};

export type NoteUpdateItem = ItemCommon & {
	kind: 'note-update';
	noteId: string;
	/** `updatedAt` of the server copy the first queued edit was based on */
	baseUpdatedAt: string | null;
	/** The server copy's values of the changed fields, when known */
	base: NoteFieldValues | null;
	changes: NoteFieldValues;
};

export type EntryCreateItem = ItemCommon & {
	kind: 'entry-create';
	tempId: string;
	input: CreateTimeEntryInput;
	/** How the entry shows in the timesheet until it reaches the server */
	display: TimeEntryDisplay;
};

export type EntryUpdateItem = ItemCommon & {
	kind: 'entry-update';
	entryId: string;
	base: Partial<TimeEntryFields> | null;
	changes: Partial<TimeEntryFields>;
	/** The changes plus display names (contract, client…) for the timesheet until replayed */
	displayPatch?: Partial<TimeEntryDisplay>;
};

export type EntryDeleteItem = ItemCommon & {
	kind: 'entry-delete';
	entryId: string;
	base: Partial<TimeEntryFields> | null;
	date: string | null;
};

export type OutboxItem = NoteCreateItem | NoteUpdateItem | EntryCreateItem | EntryUpdateItem | EntryDeleteItem;

/** What the queue persists: items in order plus the temp → real ID map of earlier replays */
export type OutboxState = {
	items: OutboxItem[];
	nextSequence: number;
	idMap: Record<string, string>;
	/** Whose queue this is; new items are tagged with it */
	ownerUserId?: string;
};

export const TEMP_ID_PREFIX = 'offline-';

export function isTempId(id: string | null | undefined): boolean {
	return typeof id === 'string' && id.startsWith(TEMP_ID_PREFIX);
}

export function emptyOutboxState(): OutboxState {
	return { items: [], nextSequence: 1, idMap: {} };
}

/** The resource an item writes, e.g. `note:ACME.20261104.001` or `entry:<uuid>` */
export function itemResourceKey(item: OutboxItem): string {
	switch (item.kind) {
		case 'note-create':
			return `note:${item.realId ?? item.tempId}`;
		case 'note-update':
			return `note:${item.noteId}`;
		case 'entry-create':
			return `entry:${item.tempId}`;
		case 'entry-update':
		case 'entry-delete':
			return `entry:${item.entryId}`;
	}
}
