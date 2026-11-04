/**
 * The user's answer to a held item (sprint 045-CL). Pure functions over the queue:
 * - keep mine: rebase the item on the server copy it was held against, so the replay sends it
 *   (if the server changes again before that, it is held again);
 * - keep the server's: drop the item;
 * - retry: a refused item goes back in the queue unchanged.
 * "Keep both" for a note is keep the server's plus a new note with my text (the held panel).
 */
import type { NoteDetail, TimeEntryFields } from '$lib/services/types';
import { ENTRY_GROUPS } from './outbox-merge';
import { removeItem } from './outbox-queue';
import type { NoteFieldValues, OutboxItem, OutboxState } from './outbox-types';

/** Fired after a held item was resolved: `{ type: 'note' | 'entry', id, choice }` */
export const OUTBOX_RESOLVED_EVENT = 'chronolog:outbox-resolved';

export type HoldChoice = 'mine' | 'server' | 'retry';

function serverNoteFields(server: Record<string, unknown>): NoteFieldValues {
	const fields: NoteFieldValues = {};
	for (const field of ['title', 'content', 'contentJson'] as const) {
		const value = server[field];
		fields[field] = typeof value === 'string' ? value : '';
	}
	return fields;
}

function serverEntryFields(server: Record<string, unknown>): Partial<TimeEntryFields> {
	const fields: Record<string, unknown> = {};
	for (const field of Object.values(ENTRY_GROUPS).flat()) {
		if (field in server) fields[field] = server[field];
	}
	return fields as Partial<TimeEntryFields>;
}

export function resolveHeldItem(state: OutboxState, sequence: number, choice: HoldChoice): void {
	const item = state.items.find((candidate) => candidate.sequence === sequence);
	if (!item) return;
	if (choice === 'server') {
		removeItem(state, sequence);
		// An entry that never reached the server: its queued edits and delete go with it, or the
		// delete would wait for a create that will never come (re-review c)
		if (item.kind === 'entry-create') {
			state.items = state.items.filter(
				(other) => !((other.kind === 'entry-update' || other.kind === 'entry-delete') && other.entryId === item.tempId)
			);
		}
		return;
	}
	const server = item.hold?.server ?? null;
	if (choice === 'mine' && server) {
		switch (item.kind) {
			case 'note-update':
				item.baseUpdatedAt = String(server.updatedAt ?? item.baseUpdatedAt);
				item.base = serverNoteFields(server);
				break;
			case 'note-create':
				item.realUpdatedAt = String(server.updatedAt ?? item.realUpdatedAt);
				break;
			case 'entry-update':
			case 'entry-delete':
				item.base = serverEntryFields(server);
				break;
		}
	}
	item.status = 'pending';
	delete item.hold;
	item.revision += 1;
}

/** The note an item writes and my text for it (the held panel's "Yours" column) */
export function myNoteText(item: OutboxItem): { noteId: string; fields: NoteFieldValues } | null {
	if (item.kind === 'note-update') return { noteId: item.noteId, fields: item.changes };
	if (item.kind === 'note-create') return { noteId: item.realId ?? item.tempId, fields: item.fields };
	return null;
}

/** The server's note text, when the item was held against one */
export function serverNoteText(item: OutboxItem): Partial<NoteDetail> | null {
	return (item.hold?.server as Partial<NoteDetail> | null | undefined) ?? null;
}
