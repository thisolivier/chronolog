/**
 * Editor sessions and their saving (split out of `NoteEditorPanel.svelte` in sprint 043-CL).
 *
 * One editor session = one mounted NoteEditor. A plain (non-reactive) object: the save function
 * is bound to it, so a flush while the editor is torn down still saves to the right note, and a
 * draft keeps its editor when the note gets created on its first save.
 */
import type { NoteSaveData } from './NoteEditor.svelte';
import type { NoteDetail } from '$lib/services/types';
import type { DataService } from '$lib/services/data-service';
import type { NavigationContext } from '$lib/stores/navigation.svelte';
import { trackNoteSave, type SaveStatus, type PersistOptions } from './note-autosave';
import { endNoteDraft } from './note-draft.svelte';
import { dispatchNoteEvent } from './note-events';
import { cachedTitlePreviewOptions, getCachedNoteTitle, rememberNoteTitle } from './note-titles.svelte';
import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
import { noteDisplayTitle } from '$lib/utils/note-display-title';

export type EditorSession = {
	key: string;
	noteId: string | null;
	contractId: string;
	initialContent: string;
	initialJson: string;
	/** true: caret at the end (a new draft); 'start': top of an opened note (followed link) */
	autofocus: boolean | 'start';
	creation: Promise<string> | null;
	/** `updatedAt` of the server copy this editor is based on (conflict detection) */
	lastSeenUpdatedAt: string | null;
	save: (data: NoteSaveData, options: PersistOptions) => Promise<void>;
	onStatus: (status: SaveStatus) => void;
};

export type SessionFields = Pick<
	EditorSession,
	'key' | 'noteId' | 'contractId' | 'initialContent' | 'initialJson' | 'autofocus' | 'lastSeenUpdatedAt'
>;

/** What the sessions need from the panel that shows them */
export interface SessionHost {
	dataService: DataService;
	navigation: NavigationContext;
	/** True while `session` is the one on screen */
	isCurrent(session: EditorSession): boolean;
	/** True once the panel is gone (phone Back): a late create must not navigate */
	isDestroyed(): boolean;
	onStatus(status: SaveStatus): void;
	/** A draft's note was created (the session is current) */
	onCreated(session: EditorSession, note: NoteDetail): void;
	/** A save of the current session reached the server */
	onUpdated(note: NoteDetail): void;
}

export function createEditorSession(fields: SessionFields, host: SessionHost): EditorSession {
	const session: EditorSession = {
		...fields,
		creation: null,
		save: (data, options) => persistSession(session, data, options, host),
		onStatus: (status) => {
			if (host.isCurrent(session)) host.onStatus(status);
		}
	};
	return session;
}

/** Create the note on the draft's first save; later saves wait for that, then update. */
export async function ensureNoteExists(
	session: EditorSession,
	data: NoteSaveData,
	host: SessionHost
): Promise<{ noteId: string; created: boolean }> {
	if (session.noteId) return { noteId: session.noteId, created: false };
	if (session.creation) return { noteId: await session.creation, created: false };
	session.creation = host.dataService.createNote(session.contractId, data).then((createdNote) => {
		session.noteId = createdNote.id;
		session.lastSeenUpdatedAt = createdNote.updatedAt;
		const preview = extractPreviewLines(data.contentJson, cachedTitlePreviewOptions);
		rememberNoteTitle(createdNote.id, {
			displayTitle: noteDisplayTitle(data.title, data.contentJson, cachedTitlePreviewOptions),
			contractId: session.contractId,
			clientId: host.navigation.selectedClientId ?? ''
		});
		dispatchNoteEvent('note-created', {
			noteId: createdNote.id,
			contractId: session.contractId,
			firstLine: preview.firstLine,
			secondLine: preview.secondLine,
			createdAt: createdNote.createdAt,
			updatedAt: createdNote.updatedAt
		});
		if (host.isCurrent(session) && !host.isDestroyed()) {
			host.onCreated(session, createdNote as unknown as NoteDetail);
			endNoteDraft();
			// The panel recognises this ID as the open session and keeps the editor mounted
			host.navigation.selectNote(createdNote.id);
		}
		return createdNote.id;
	});
	// A failed create must not poison later retries of this draft
	session.creation.catch(() => {
		if (!session.noteId) session.creation = null;
	});
	return { noteId: await session.creation, created: true };
}

function persistSession(session: EditorSession, data: NoteSaveData, options: PersistOptions, host: SessionHost): Promise<void> {
	// Register an update synchronously, so a panel that remounts on this note right away
	// (layout change) waits for it before loading.
	if (session.noteId) return trackNoteSave(session.noteId, updateSessionNote(session, session.noteId, data, options, host));
	return ensureNoteExists(session, data, host).then(({ noteId, created }) =>
		created ? undefined : trackNoteSave(noteId, updateSessionNote(session, noteId, data, options, host))
	);
}

async function updateSessionNote(
	session: EditorSession,
	noteId: string,
	data: NoteSaveData,
	options: PersistOptions,
	host: SessionHost
): Promise<void> {
	// Rejects with status 409 if the note changed elsewhere (another tab); the editor
	// then stops autosaving and asks for a reload instead of overwriting.
	const updatedNote = await host.dataService.updateNote(
		noteId,
		{ ...data, expectedUpdatedAt: session.lastSeenUpdatedAt ?? undefined },
		{ keepalive: options.keepalive }
	);
	session.lastSeenUpdatedAt = updatedNote.updatedAt;
	if (host.isCurrent(session)) host.onUpdated(updatedNote);

	const preview = extractPreviewLines(data.contentJson, cachedTitlePreviewOptions);
	rememberNoteTitle(noteId, {
		displayTitle: noteDisplayTitle(data.title, data.contentJson, cachedTitlePreviewOptions),
		contractId: updatedNote.contractId,
		clientId: getCachedNoteTitle(noteId)?.clientId ?? host.navigation.selectedClientId ?? ''
	});
	dispatchNoteEvent('note-saved', {
		noteId,
		firstLine: preview.firstLine,
		secondLine: preview.secondLine,
		updatedAt: updatedNote.updatedAt
	});
}
