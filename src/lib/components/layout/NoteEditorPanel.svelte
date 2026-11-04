<script lang="ts">
	import FindBar from '$lib/components/find/FindBar.svelte';
	import { onDestroy, untrack } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import NoteEditor, { type NoteSaveData } from '$lib/components/notes/NoteEditor.svelte';
	import NoteEditorHeader from '$lib/components/notes/NoteEditorHeader.svelte';
	import NoteBacklinks from '$lib/components/notes/NoteBacklinks.svelte';
	import LinkedTimeEntries from '$lib/components/notes/LinkedTimeEntries.svelte';
	import AttachmentList from '$lib/components/notes/AttachmentList.svelte';
	import { buildChronologUrl } from '$lib/components/notes/extensions/attachment-resolver.js';
	import { exportAsMarkdown } from '$lib/components/notes/note-export';
	import { printNote } from '$lib/components/notes/note-print';
	import { trackNoteSave, waitForNoteSaves, type SaveStatus, type PersistOptions } from '$lib/components/notes/note-autosave';
	import { noteDraft, startNoteDraft, endNoteDraft } from '$lib/components/notes/note-draft.svelte';
	import { dispatchNoteEvent } from '$lib/components/notes/note-events';
	import { getCachedNoteTitle, rememberNoteTitle, requestNoteTitles, isNoteInTrash, setNoteTrashed, wikiLinkDisplayText } from '$lib/components/notes/note-titles.svelte';
	import { restoreTrashedNote, showRestorePrompt } from '$lib/components/notes/note-trash';
	import { useNoteNavigation } from '$lib/components/notes/note-navigation';
	import '$lib/components/notes/print-styles.css';
	import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
	import { noteDisplayTitle } from '$lib/utils/note-display-title';
	import type { NoteDetail, Backlink, ContractOption } from '$lib/services/types';

	const navigation = getNavigationContext();
	const dataService = getDataService();
	const noteNavigation = useNoteNavigation(navigation);

	/**
	 * One editor session = one mounted NoteEditor. Plain (non-reactive) object: the save
	 * function is bound to it, so a flush while the editor is torn down still saves to the
	 * right note, and a draft keeps its editor when the note gets created.
	 */
	type EditorSession = {
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

	let editorSession = $state.raw<EditorSession | null>(null);
	// Reactive mirror of editorSession.noteId (the session object itself is not reactive)
	let activeNoteId = $state<string | null>(null);
	let currentNote = $state<NoteDetail | null>(null);
	let isLoading = $state(false);
	let fetchError = $state<string | null>(null);
	let backlinks = $state<Backlink[]>([]);
	let saveStatus = $state<SaveStatus>('saved');
	let headerMessage = $state<string | null>(null);
	let headerMessageTimeout: ReturnType<typeof setTimeout> | undefined;
	/** "Moved to trash. Undo" for ten seconds after a delete (sprint 037-CL) */
	let trashToast = $state<{ noteId: string; contractId: string; clientId: string } | null>(null);
	let trashToastTimeout: ReturnType<typeof setTimeout> | undefined;
	const TRASH_TOAST_MILLISECONDS = 10_000;
	let draftSessionCounter = 0;
	/** Set on destroy: a create that finishes afterwards must not navigate (phone Back) */
	let isPanelDestroyed = false;
	let editorComponent = $state<{ flushPendingSave: () => Promise<void> } | null>(null);

	function setEditorSession(session: EditorSession | null) {
		editorSession = session;
		activeNoteId = session?.noteId ?? null;
	}

	function showHeaderMessage(message: string) {
		headerMessage = message;
		clearTimeout(headerMessageTimeout);
		headerMessageTimeout = setTimeout(() => {
			headerMessage = null;
		}, 3000);
	}

	function createSession(
		fields: Pick<EditorSession, 'key' | 'noteId' | 'contractId' | 'initialContent' | 'initialJson' | 'autofocus' | 'lastSeenUpdatedAt'>
	): EditorSession {
		const session: EditorSession = {
			...fields,
			creation: null,
			save: (data, options) => persistSession(session, data, options),
			onStatus: (status) => {
				if (editorSession === session) saveStatus = status;
			}
		};
		return session;
	}

	/** Create the note on the draft's first save; later saves wait for that, then update. */
	async function ensureNoteExists(session: EditorSession, data: NoteSaveData): Promise<{ noteId: string; created: boolean }> {
		if (session.noteId) return { noteId: session.noteId, created: false };
		if (!session.creation) {
			session.creation = dataService.createNote(session.contractId, data).then((createdNote) => {
				session.noteId = createdNote.id;
				session.lastSeenUpdatedAt = createdNote.updatedAt;
				if (editorSession === session) activeNoteId = createdNote.id;
				const preview = extractPreviewLines(data.contentJson);
				rememberNoteTitle(createdNote.id, {
					displayTitle: noteDisplayTitle(data.title, data.contentJson),
					contractId: session.contractId,
					clientId: navigation.selectedClientId ?? ''
				});
				dispatchNoteEvent('note-created', {
					noteId: createdNote.id,
					contractId: session.contractId,
					firstLine: preview.firstLine,
					secondLine: preview.secondLine,
					createdAt: createdNote.createdAt,
					updatedAt: createdNote.updatedAt
				});
				if (editorSession === session && !isPanelDestroyed) {
					currentNote = createdNote as unknown as NoteDetail;
					endNoteDraft();
					// The panel recognises this ID as the open session and keeps the editor mounted
					navigation.selectNote(createdNote.id);
				}
				return createdNote.id;
			});
			// A failed create must not poison later retries of this draft
			session.creation.catch(() => {
				if (!session.noteId) session.creation = null;
			});
			const createdNoteId = await session.creation;
			return { noteId: createdNoteId, created: true };
		}
		return { noteId: await session.creation, created: false };
	}

	function persistSession(session: EditorSession, data: NoteSaveData, options: PersistOptions): Promise<void> {
		// Register an update synchronously, so a panel that remounts on this note right away
		// (layout change) waits for it before loading.
		if (session.noteId) return trackNoteSave(session.noteId, updateSessionNote(session, session.noteId, data, options));
		return ensureNoteExists(session, data).then(({ noteId, created }) =>
			created ? undefined : trackNoteSave(noteId, updateSessionNote(session, noteId, data, options))
		);
	}

	async function updateSessionNote(
		session: EditorSession,
		noteId: string,
		data: NoteSaveData,
		options: PersistOptions
	): Promise<void> {
		// Rejects with status 409 if the note changed elsewhere (another tab); the editor
		// then stops autosaving and asks for a reload instead of overwriting.
		const updatedNote = await dataService.updateNote(
			noteId,
			{ ...data, expectedUpdatedAt: session.lastSeenUpdatedAt ?? undefined },
			{ keepalive: options.keepalive }
		);
		session.lastSeenUpdatedAt = updatedNote.updatedAt;
		if (editorSession === session) currentNote = updatedNote;

		const preview = extractPreviewLines(data.contentJson);
		rememberNoteTitle(noteId, {
			displayTitle: noteDisplayTitle(data.title, data.contentJson),
			contractId: updatedNote.contractId,
			clientId: getCachedNoteTitle(noteId)?.clientId ?? navigation.selectedClientId ?? ''
		});
		dispatchNoteEvent('note-saved', {
			noteId,
			firstLine: preview.firstLine,
			secondLine: preview.secondLine,
			updatedAt: updatedNote.updatedAt
		});
	}

	/** Load an existing note (after any in-flight save of it) and open an editor for it. */
	/** The note being fetched: a second request to open it while it loads is the same request */
	let loadingNoteId: string | null = null;

	/**
	 * A note opened by following a link takes keyboard focus at its top (A-11), except on touch
	 * screens, where focusing would pop up the on-screen keyboard over the note.
	 */
	function takeEditorFocus(noteId: string): 'start' | false {
		if (!navigation.takeEditorFocus(noteId)) return false;
		const isTouchScreen = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
		return isTouchScreen ? false : 'start';
	}

	async function openExistingNote(noteId: string) {
		if (loadingNoteId === noteId) return;
		loadingNoteId = noteId;
		isLoading = true;
		fetchError = null;
		currentNote = null;
		setEditorSession(null);
		backlinks = [];

		try {
			// Let an editor being torn down in this same update start its final save first
			await new Promise((resolve) => setTimeout(resolve, 0));
			await waitForNoteSaves(noteId);
			const note = await dataService.getNoteById(noteId);
			if (navigation.selectedNoteId !== noteId) return; // user moved on meanwhile
			// One invariant: an open note is shown under its own contract. A bookmark or link
			// with the wrong contract in the URL is corrected in place.
			if (note.contractId !== navigation.selectedContractId) {
				navigation.openNote(note.id, note.contractId, getCachedNoteTitle(note.id)?.clientId ?? '', { replace: true });
			}
			currentNote = note;
			saveStatus = 'saved';
			setEditorSession(createSession({
				key: note.id,
				noteId: note.id,
				contractId: note.contractId,
				initialContent: note.content ?? '',
				initialJson: note.contentJson ?? '',
				autofocus: takeEditorFocus(note.id),
				lastSeenUpdatedAt: note.updatedAt
			}));
			void fetchBacklinks(noteId);
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'Unknown error loading note';
			console.error('Error fetching note:', error);
		} finally {
			if (loadingNoteId === noteId) loadingNoteId = null;
			if (navigation.selectedNoteId === noteId) isLoading = false;
		}
	}

	function openDraft(contractId: string) {
		draftSessionCounter += 1;
		currentNote = null;
		fetchError = null;
		backlinks = [];
		isLoading = false;
		saveStatus = 'saved';
		setEditorSession(createSession({
			key: `draft-${draftSessionCounter}`,
			noteId: null,
			contractId,
			initialContent: '',
			initialJson: '',
			autofocus: true,
			lastSeenUpdatedAt: null
		}));
	}

	async function fetchBacklinks(noteId: string) {
		try {
			const loadedBacklinks = await dataService.getNoteBacklinks(noteId);
			if (editorSession?.noteId !== noteId) return;
			backlinks = loadedBacklinks;
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
			backlinks = [];
		}
	}

	/** Upload a file as an attachment and return a chronolog:// URL */
	async function handleFileUpload(file: File): Promise<string | null> {
		const session = editorSession;
		if (!session) return null;
		try {
			// A draft needs a note to attach to: create it first
			const { noteId } = session.noteId
				? { noteId: session.noteId }
				: await ensureNoteExists(session, { title: '', content: '', contentJson: '' });
			const result = await dataService.uploadAttachment(noteId, file);
			window.dispatchEvent(new CustomEvent('note-attachments-changed', { detail: { noteId } }));
			return buildChronologUrl(result.id);
		} catch (uploadError) {
			console.error('Error uploading file:', uploadError);
			showHeaderMessage('Upload failed');
			return null;
		}
	}

	/** Move the current note to a different contract */
	async function handleMoveToContract(targetContract: ContractOption) {
		const noteId = editorSession?.noteId;
		if (!noteId) return;
		const previousContractId = currentNote?.contractId;

		try {
			await editorComponent?.flushPendingSave();
			await waitForNoteSaves(noteId);
			const session = editorSession;
			const updatedNote = await dataService.updateNote(noteId, { contractId: targetContract.id });
			currentNote = updatedNote;
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
			showHeaderMessage('Failed to move note');
		}
	}

	async function handleDelete() {
		const session = editorSession;
		if (!session) return;
		if (!session.noteId) {
			// Unsaved draft: nothing on the server to delete
			endNoteDraft();
			setEditorSession(null);
			navigation.clearSelectedNote();
			return;
		}
		const noteId = session.noteId;
		const contractId = currentNote?.contractId ?? session.contractId;
		const clientId = getCachedNoteTitle(noteId)?.clientId || navigation.selectedClientId || '';
		try {
			await waitForNoteSaves(noteId);
			await dataService.deleteNote(noteId);
			setEditorSession(null); // unmount first so the editor does not save it again
			setNoteTrashed(noteId, new Date().toISOString());
			dispatchNoteEvent('note-deleted', { noteId, contractId });
			navigation.clearSelectedNote();
			showTrashToast({ noteId, contractId, clientId });
		} catch (deleteError) {
			console.error('Error deleting note:', deleteError);
			showHeaderMessage('Failed to delete note');
		}
	}

	function showTrashToast(toast: { noteId: string; contractId: string; clientId: string }) {
		trashToast = toast;
		clearTimeout(trashToastTimeout);
		trashToastTimeout = setTimeout(() => (trashToast = null), TRASH_TOAST_MILLISECONDS);
	}

	/** Undo: take the note out of the trash and open it again */
	async function undoDelete() {
		const toast = trashToast;
		if (!toast) return;
		trashToast = null;
		clearTimeout(trashToastTimeout);
		try {
			const restored = await restoreTrashedNote(dataService, toast.noteId);
			navigation.openNote(toast.noteId, restored.note.contractId, toast.clientId);
		} catch (restoreError) {
			console.error('Error restoring note:', restoreError);
			showHeaderMessage('Could not restore the note');
		}
	}

	/** A wiki-link: open the note; a note in the trash offers a restore next to the link first */
	async function handleWikiLinkClick(noteId: string, element: HTMLElement) {
		if (!isNoteInTrash(noteId) && (await noteNavigation.openNoteById(noteId))) return;
		if (!isNoteInTrash(noteId)) {
			showHeaderMessage('That note no longer exists');
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

	async function handleExportMarkdown() {
		await editorComponent?.flushPendingSave();
		const noteId = editorSession?.noteId;
		if (!noteId) return;
		await waitForNoteSaves(noteId);
		const title = currentNote?.title || noteDisplayTitle(null, currentNote?.contentJson) || noteId;
		exportAsMarkdown(title, currentNote?.content ?? null);
	}

	async function handleExportPdf() {
		const editorRoot = document.querySelector<HTMLElement>('[data-note-editor-content] .tiptap');
		if (!editorRoot || !editorSession) return;
		const noteId = editorSession.noteId ?? 'New note';
		const title = noteDisplayTitle(currentNote?.title, currentNote?.contentJson) ?? noteId;
		try {
			await printNote({ title, noteId, editorRoot });
		} catch (printError) {
			console.error('Error printing note:', printError);
			showHeaderMessage('Could not open print');
		}
	}

	onDestroy(() => {
		isPanelDestroyed = true;
		clearTimeout(headerMessageTimeout);
		clearTimeout(trashToastTimeout);
		// Leaving the panel (phone Back) ends an open draft; if something was typed the
		// editor's final save still creates the note.
		if (editorSession && !editorSession.noteId) endNoteDraft();
	});

	// Open whatever the URL selects: an existing note, a draft (`/notes/<contract>/new`), or nothing.
	let openedDraftToken = -1;
	$effect(() => {
		const selectedNoteId = navigation.selectedNoteId;
		const selectedContractId = navigation.selectedContractId;
		const isDraftRoute = navigation.isDraftOpen;
		const draftToken = noteDraft.token;
		const draftContractId = noteDraft.contractId;

		untrack(() => {
			if (selectedNoteId) {
				// A draft that was just created is already open under this ID
				if (editorSession?.noteId === selectedNoteId) return;
				void openExistingNote(selectedNoteId);
			} else if (isDraftRoute && selectedContractId) {
				// Reload or Forward onto a draft URL: start the draft it names (the effect re-runs)
				if (draftContractId !== selectedContractId) {
					startNoteDraft(selectedContractId);
					return;
				}
				if (draftToken === openedDraftToken && editorSession && !editorSession.noteId) return;
				openedDraftToken = draftToken;
				openDraft(selectedContractId);
			} else {
				if (draftContractId) endNoteDraft();
				setEditorSession(null);
				currentNote = null;
				fetchError = null;
				backlinks = [];
				isLoading = false;
			}
		});
	});

	// Titles for the "Linked from" chips are also needed by wiki-links elsewhere
	$effect(() => {
		requestNoteTitles(backlinks.map((backlink) => backlink.sourceNoteId));
	});
</script>

<div class="flex h-full flex-col overflow-y-auto bg-stone-50">
	<FindBar mode="editor" />
	{#if isLoading}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-stone-500">Loading note...</p>
		</div>
	{:else if fetchError}
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<p class="text-red-600">{fetchError}</p>
				<button
					onclick={() => navigation.selectedNoteId && openExistingNote(navigation.selectedNoteId)}
					class="mt-2 text-sm text-blue-600 hover:text-blue-800"
				>
					Try again
				</button>
			</div>
		</div>
	{:else if editorSession}
		{@const session = editorSession}
		<NoteEditorHeader
			noteId={activeNoteId}
			contractId={currentNote?.contractId ?? session.contractId}
			{saveStatus}
			message={headerMessage}
			onMove={handleMoveToContract}
			onExportMarkdown={handleExportMarkdown}
			onExportPdf={handleExportPdf}
			onDelete={handleDelete}
			onReload={() => session.noteId && openExistingNote(session.noteId)}
		/>

		<!-- Editor: re-mounted per session; a draft keeps its editor when it is created -->
		<div class="flex min-h-[24rem] flex-1 flex-col">
			{#key session.key}
				<NoteEditor
					bind:this={editorComponent}
					initialContent={session.initialContent}
					initialJson={session.initialJson}
					getNoteId={() => session.noteId}
					autofocus={session.autofocus}
					onSave={session.save}
					onSaveStatusChange={session.onStatus}
					onFileUpload={handleFileUpload}
					onWikiLinkClick={(noteId, _headingAnchor, element) => handleWikiLinkClick(noteId, element)}
				/>
			{/key}
		</div>

		{#if activeNoteId}
			<NoteBacklinks {backlinks} onOpen={(backlink) => noteNavigation.openBacklink(backlink)} />
			<LinkedTimeEntries noteId={activeNoteId} />
			<AttachmentList noteId={activeNoteId} />
		{/if}
	{:else}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-stone-400">Select a note to view</p>
		</div>
	{/if}

	{#if trashToast}
		<div
			role="status"
			data-testid="note-trash-toast"
			class="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-md bg-stone-800 px-4 py-2 text-sm text-white shadow-lg"
		>
			<span>Moved to trash.</span>
			<button type="button" onclick={undoDelete} class="font-semibold text-indigo-300 hover:text-indigo-200">Undo</button>
		</div>
	{/if}
</div>
