/**
 * The editor panel's actions (split out of `NoteEditorPanel.svelte` in sprint 043-CL): upload,
 * move to another contract, delete (with the shell-level Undo toast), following a wiki-link and
 * the two exports. Each works on the panel's `NotePanelState` and reports problems through
 * `showMessage` (the header's transient message).
 */
import type { ContractOption } from '$lib/services/types';
import { buildChronologUrl } from './extensions/attachment-resolver.js';
import { exportAsMarkdown } from './note-export';
import { printNote } from './note-print';
import { waitForNoteSaves } from './note-autosave';
import { endNoteDraft } from './note-draft.svelte';
import { dispatchNoteEvent } from './note-events';
import { getCachedNoteTitle, rememberNoteTitle, isNoteInTrash, setNoteTrashed, wikiLinkDisplayText } from './note-titles.svelte';
import { restoreTrashedNote, showRestorePrompt } from './note-trash';
import { showTrashToast } from './note-trash-toast.svelte';
import { ensureNoteExists } from './note-editor-session';
import type { NotePanelState } from './note-panel-state.svelte';
import type { useNoteNavigation } from './note-navigation';
import { noteDisplayTitle } from '$lib/utils/note-display-title';

export type PanelActionContext = {
	panel: NotePanelState;
	noteNavigation: ReturnType<typeof useNoteNavigation>;
	getEditor: () => { flushPendingSave: () => Promise<void> } | null;
	showMessage: (message: string) => void;
};

export function createNotePanelActions({ panel, noteNavigation, getEditor, showMessage }: PanelActionContext) {
	const { dataService, navigation } = panel;

	/** Upload a file as an attachment and return a chronolog:// URL */
	async function uploadFile(file: File): Promise<string | null> {
		const session = panel.editorSession;
		if (!session) return null;
		try {
			// A draft needs a note to attach to: create it first
			const { noteId } = session.noteId
				? { noteId: session.noteId }
				: await ensureNoteExists(session, { title: '', content: '', contentJson: '' }, panel.host);
			const result = await dataService.uploadAttachment(noteId, file);
			window.dispatchEvent(new CustomEvent('note-attachments-changed', { detail: { noteId } }));
			return buildChronologUrl(result.id);
		} catch (uploadError) {
			console.error('Error uploading file:', uploadError);
			showMessage('Upload failed');
			return null;
		}
	}

	/** Move the current note to a different contract */
	async function moveToContract(targetContract: ContractOption) {
		const noteId = panel.editorSession?.noteId;
		if (!noteId) return;
		const previousContractId = panel.currentNote?.contractId;
		try {
			await getEditor()?.flushPendingSave();
			await waitForNoteSaves(noteId);
			const session = panel.editorSession;
			const updatedNote = await dataService.updateNote(noteId, { contractId: targetContract.id });
			panel.currentNote = updatedNote;
			if (session) {
				session.lastSeenUpdatedAt = updatedNote.updatedAt;
				session.contractId = targetContract.id;
			}
			rememberNoteTitle(noteId, {
				displayTitle: getCachedNoteTitle(noteId)?.displayTitle ?? null,
				contractId: targetContract.id,
				clientId: targetContract.clientId ?? ''
			});
			// The note stays open and the sidebar and list follow it to its new contract
			// (the editor is kept: its session already holds this note ID).
			dispatchNoteEvent('note-moved', {
				noteId,
				fromContractId: previousContractId,
				toContractId: targetContract.id,
				toContractName: targetContract.name ?? null,
				toClientName: targetContract.clientName ?? null
			});
			navigation.openNote(noteId, targetContract.id, targetContract.clientId);
		} catch (moveError) {
			console.error('Error moving note:', moveError);
			showMessage('Failed to move note');
		}
	}

	async function deleteNote() {
		const session = panel.editorSession;
		if (!session) return;
		if (!session.noteId) {
			// Unsaved draft: nothing on the server to delete
			endNoteDraft();
			panel.setEditorSession(null);
			navigation.clearSelectedNote();
			return;
		}
		const noteId = session.noteId;
		const contractId = panel.currentNote?.contractId ?? session.contractId;
		const clientId = getCachedNoteTitle(noteId)?.clientId || navigation.selectedClientId || '';
		try {
			await waitForNoteSaves(noteId);
			await dataService.deleteNote(noteId);
			panel.setEditorSession(null); // unmount first so the editor does not save it again
			setNoteTrashed(noteId, new Date().toISOString());
			dispatchNoteEvent('note-deleted', { noteId, contractId });
			navigation.clearSelectedNote();
			showTrashToast({ noteId, contractId, clientId });
		} catch (deleteError) {
			console.error('Error deleting note:', deleteError);
			showMessage('Failed to delete note');
		}
	}

	/** A wiki-link: open the note; a note in the trash offers a restore next to the link first */
	async function followWikiLink(noteId: string, element: HTMLElement) {
		if (!isNoteInTrash(noteId) && (await noteNavigation.openNoteById(noteId))) return;
		if (!isNoteInTrash(noteId)) {
			showMessage('That note no longer exists');
			return;
		}
		showRestorePrompt(element, {
			title: wikiLinkDisplayText(noteId),
			onRestore: async () => {
				await restoreTrashedNote(dataService, noteId);
				await noteNavigation.openNoteById(noteId);
			}
		});
	}

	async function exportMarkdown() {
		await getEditor()?.flushPendingSave();
		const noteId = panel.editorSession?.noteId;
		if (!noteId) return;
		await waitForNoteSaves(noteId);
		const currentNote = panel.currentNote;
		const title = currentNote?.title || noteDisplayTitle(null, currentNote?.contentJson) || noteId;
		exportAsMarkdown(title, currentNote?.content ?? null);
	}

	async function exportPdf() {
		const editorRoot = document.querySelector<HTMLElement>('[data-note-editor-content] .tiptap');
		if (!editorRoot || !panel.editorSession) return;
		const noteId = panel.editorSession.noteId ?? 'New note';
		const title = noteDisplayTitle(panel.currentNote?.title, panel.currentNote?.contentJson) ?? noteId;
		try {
			await printNote({ title, noteId, editorRoot });
		} catch (printError) {
			console.error('Error printing note:', printError);
			showMessage('Could not open print');
		}
	}

	return { uploadFile, moveToContract, deleteNote, followWikiLink, exportMarkdown, exportPdf };
}
