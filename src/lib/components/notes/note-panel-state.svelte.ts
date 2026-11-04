/**
 * What the note editor panel shows (split out of `NoteEditorPanel.svelte` in sprint 043-CL):
 * the open editor session, the loaded note, its backlinks, loading and save status. `showUrlSelection`
 * opens whatever the URL selects: an existing note, a draft (`/notes/<contract>/new`) or nothing.
 */
import type { DataService } from '$lib/services/data-service';
import type { NavigationContext } from '$lib/stores/navigation.svelte';
import type { Backlink, NoteDetail } from '$lib/services/types';
import { waitForNoteSaves, type SaveStatus } from './note-autosave';
import { endNoteDraft, startNoteDraft } from './note-draft.svelte';
import { getCachedNoteTitle, rememberNoteTitle } from './note-titles.svelte';
import { createEditorSession, type EditorSession, type SessionFields, type SessionHost } from './note-editor-session';

export class NotePanelState {
	editorSession = $state.raw<EditorSession | null>(null);
	/** Reactive mirror of editorSession.noteId (the session object itself is not reactive) */
	activeNoteId = $state<string | null>(null);
	currentNote = $state<NoteDetail | null>(null);
	isLoading = $state(false);
	fetchError = $state<string | null>(null);
	backlinks = $state<Backlink[]>([]);
	saveStatus = $state<SaveStatus>('saved');
	/** Set on destroy: a create that finishes afterwards must not navigate (phone Back) */
	isDestroyed = false;

	readonly host: SessionHost;
	private draftSessionCounter = 0;
	/** The note being fetched: a second request to open it while it loads is the same request */
	private loadingNoteId: string | null = null;
	private openedDraftToken = -1;

	constructor(
		readonly dataService: DataService,
		readonly navigation: NavigationContext
	) {
		this.host = {
			dataService,
			navigation,
			isCurrent: (session) => this.editorSession === session,
			isDestroyed: () => this.isDestroyed,
			onStatus: (status) => (this.saveStatus = status),
			onCreated: (session, note) => {
				this.activeNoteId = session.noteId;
				this.currentNote = note;
			},
			onUpdated: (note) => (this.currentNote = note)
		};
	}

	setEditorSession(session: EditorSession | null) {
		this.editorSession = session;
		this.activeNoteId = session?.noteId ?? null;
	}

	private createSession(fields: SessionFields): EditorSession {
		return createEditorSession(fields, this.host);
	}

	/**
	 * A note opened by following a link takes keyboard focus at its top (A-11), except on touch
	 * screens, where focusing would pop up the on-screen keyboard over the note.
	 */
	private takeEditorFocus(noteId: string): 'start' | false {
		if (!this.navigation.takeEditorFocus(noteId)) return false;
		const isTouchScreen = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
		return isTouchScreen ? false : 'start';
	}

	/** Load an existing note (after any in-flight save of it) and open an editor for it. */
	async openExistingNote(noteId: string) {
		if (this.loadingNoteId === noteId) return;
		this.loadingNoteId = noteId;
		this.isLoading = true;
		this.fetchError = null;
		this.currentNote = null;
		this.setEditorSession(null);
		this.backlinks = [];

		try {
			// Let an editor being torn down in this same update start its final save first
			await new Promise((resolve) => setTimeout(resolve, 0));
			await waitForNoteSaves(noteId);
			const note = await this.dataService.getNoteById(noteId);
			if (this.navigation.selectedNoteId !== noteId) return; // user moved on meanwhile
			// One invariant: an open note is shown under its own contract. A bookmark or link
			// with the wrong contract in the URL is corrected in place.
			if (note.contractId !== this.navigation.selectedContractId) {
				this.navigation.openNote(note.id, note.contractId, getCachedNoteTitle(note.id)?.clientId ?? '', { replace: true });
			}
			this.currentNote = note;
			this.saveStatus = 'saved';
			this.setEditorSession(
				this.createSession({
					key: note.id,
					noteId: note.id,
					contractId: note.contractId,
					initialContent: note.content ?? '',
					initialJson: note.contentJson ?? '',
					autofocus: this.takeEditorFocus(note.id),
					lastSeenUpdatedAt: note.updatedAt
				})
			);
			void this.fetchBacklinks(noteId);
		} catch (error) {
			this.fetchError = error instanceof Error ? error.message : 'Unknown error loading note';
			console.error('Error fetching note:', error);
		} finally {
			if (this.loadingNoteId === noteId) this.loadingNoteId = null;
			if (this.navigation.selectedNoteId === noteId) this.isLoading = false;
		}
	}

	private openDraft(contractId: string) {
		this.draftSessionCounter += 1;
		this.currentNote = null;
		this.fetchError = null;
		this.backlinks = [];
		this.isLoading = false;
		this.saveStatus = 'saved';
		this.setEditorSession(
			this.createSession({
				key: `draft-${this.draftSessionCounter}`,
				noteId: null,
				contractId,
				initialContent: '',
				initialJson: '',
				autofocus: true,
				lastSeenUpdatedAt: null
			})
		);
	}

	private async fetchBacklinks(noteId: string) {
		try {
			const loadedBacklinks = await this.dataService.getNoteBacklinks(noteId);
			if (this.editorSession?.noteId !== noteId) return;
			this.backlinks = loadedBacklinks;
			for (const backlink of loadedBacklinks) {
				if (backlink.noteContractId) {
					rememberNoteTitle(backlink.sourceNoteId, {
						displayTitle: backlink.noteTitle,
						contractId: backlink.noteContractId,
						clientId: backlink.noteClientId ?? ''
					});
				}
			}
		} catch (backlinkError) {
			console.error('Error fetching backlinks:', backlinkError);
			this.backlinks = [];
		}
	}

	/** Open whatever the URL selects; run untracked from the panel's effect. */
	showUrlSelection(selection: {
		selectedNoteId: string | null;
		selectedContractId: string | null;
		isDraftRoute: boolean;
		draftToken: number;
		draftContractId: string | null;
	}) {
		const { selectedNoteId, selectedContractId, isDraftRoute, draftToken, draftContractId } = selection;
		if (selectedNoteId) {
			// A draft that was just created is already open under this ID
			if (this.editorSession?.noteId === selectedNoteId) return;
			void this.openExistingNote(selectedNoteId);
		} else if (isDraftRoute && selectedContractId) {
			// Reload or Forward onto a draft URL: start the draft it names (the effect re-runs)
			if (draftContractId !== selectedContractId) {
				startNoteDraft(selectedContractId);
				return;
			}
			if (draftToken === this.openedDraftToken && this.editorSession && !this.editorSession.noteId) return;
			this.openedDraftToken = draftToken;
			this.openDraft(selectedContractId);
		} else {
			if (draftContractId) endNoteDraft();
			this.setEditorSession(null);
			this.currentNote = null;
			this.fetchError = null;
			this.backlinks = [];
			this.isLoading = false;
		}
	}

	/** Leaving the panel (phone Back) ends an open draft; the editor's final save still creates it. */
	destroy() {
		this.isDestroyed = true;
		if (this.editorSession && !this.editorSession.noteId) endNoteDraft();
	}
}
