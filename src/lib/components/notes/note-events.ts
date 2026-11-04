/**
 * Window events the notes UI dispatches so other panels can stay in sync without
 * sharing component state. `note-saved` and `note-moved` predate this module.
 *
 * - `note-created`  { noteId, contractId, firstLine, secondLine, createdAt, updatedAt }
 * - `note-saved`    { noteId, firstLine, secondLine, updatedAt }
 * - `note-moved`    { noteId, fromContractId, toContractId, toContractName, toClientName }
 * - `note-deleted`  { noteId, contractId }   (moved to the trash, sprint 037-CL)
 * - `note-restored` { noteId, contractId }   (back from the trash with the same ID)
 *
 * Sidebar note counts change on `note-created`, `note-moved`, `note-deleted` and `note-restored`;
 * `onNoteCountsChanged` subscribes to exactly those.
 */

export type NoteCreatedDetail = {
	noteId: string;
	contractId: string;
	firstLine: string;
	secondLine: string;
	createdAt: string;
	updatedAt: string;
};

export type NoteSavedDetail = {
	noteId: string;
	firstLine: string;
	secondLine: string;
	updatedAt: string;
};

export type NoteMovedDetail = {
	noteId: string;
	fromContractId: string | undefined;
	toContractId: string;
	toContractName: string | null;
	toClientName: string | null;
};

export type NoteDeletedDetail = {
	noteId: string;
	contractId: string | undefined;
};

export type NoteRestoredDetail = {
	noteId: string;
	contractId: string;
};

type NoteEventMap = {
	'note-created': NoteCreatedDetail;
	'note-saved': NoteSavedDetail;
	'note-moved': NoteMovedDetail;
	'note-deleted': NoteDeletedDetail;
	'note-restored': NoteRestoredDetail;
};

export type NoteEventName = keyof NoteEventMap;

export function dispatchNoteEvent<Name extends NoteEventName>(
	name: Name,
	detail: NoteEventMap[Name]
): void {
	window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Listen to one note event; returns an unsubscribe function. */
export function onNoteEvent<Name extends NoteEventName>(
	name: Name,
	handler: (detail: NoteEventMap[Name]) => void
): () => void {
	const listener = (event: Event) => handler((event as CustomEvent<NoteEventMap[Name]>).detail);
	window.addEventListener(name, listener);
	return () => window.removeEventListener(name, listener);
}

/** Run `handler` whenever per-contract note counts may have changed. */
export function onNoteCountsChanged(handler: () => void): () => void {
	const unsubscribers = (['note-created', 'note-moved', 'note-deleted', 'note-restored'] as const).map((name) =>
		onNoteEvent(name, () => handler())
	);
	return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
