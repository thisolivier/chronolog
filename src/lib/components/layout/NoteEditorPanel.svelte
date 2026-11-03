<script lang="ts">
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
	import { noteDraft, endNoteDraft } from '$lib/components/notes/note-draft.svelte';
	import { dispatchNoteEvent } from '$lib/components/notes/note-events';
	import { getCachedNoteTitle, rememberNoteTitle, forgetNoteTitle, requestNoteTitles } from '$lib/components/notes/note-titles.svelte';
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
		autofocus: boolean;
		creation: Promise<string> | null;
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
	let draftSessionCounter = 0;
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

	function createSession(fields: Pick<EditorSession, 'key' | 'noteId' | 'contractId' | 'initialContent' | 'initialJson' | 'autofocus'>): EditorSession {
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
				if (editorSession === session) {
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

	async function persistSession(session: EditorSession, data: NoteSaveData, options: PersistOptions): Promise<void> {
		const { noteId, created } = await ensureNoteExists(session, data);
		if (created) return; // the create carried this snapshot

		const updatedNote = await trackNoteSave(
			noteId,
			dataService.updateNote(noteId, data, { keepalive: options.keepalive })
		);
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
	async function openExistingNote(noteId: string) {
		isLoading = true;
		fetchError = null;
		currentNote = null;
		setEditorSession(null);
		backlinks = [];

		try {
			await waitForNoteSaves(noteId);
			const note = await dataService.getNoteById(noteId);
			if (navigation.selectedNoteId !== noteId) return; // user moved on meanwhile
			currentNote = note;
			saveStatus = 'saved';
			setEditorSession(createSession({
				key: note.id,
				noteId: note.id,
				contractId: note.contractId,
				initialContent: note.content ?? '',
				initialJson: note.contentJson ?? '',
				autofocus: false
			}));
			void fetchBacklinks(noteId);
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'Unknown error loading note';
			console.error('Error fetching note:', error);
		} finally {
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
			autofocus: true
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
			const updatedNote = await dataService.updateNote(noteId, { contractId: targetContract.id });
			currentNote = updatedNote;
			rememberNoteTitle(noteId, {
				displayTitle: getCachedNoteTitle(noteId)?.displayTitle ?? null,
				contractId: targetContract.id,
				clientId: targetContract.clientId ?? ''
			});
			// The notes list removes the note, clears the selection (unmounting this
			// header) and shows the success message.
			dispatchNoteEvent('note-moved', {
				noteId,
				fromContractId: previousContractId,
				toContractId: targetContract.id,
				toContractName: targetContract.name ?? null,
				toClientName: targetContract.clientName ?? null
			});
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
			return;
		}
		const noteId = session.noteId;
		try {
			await waitForNoteSaves(noteId);
			await dataService.deleteNote(noteId);
			setEditorSession(null); // unmount first so the editor does not save it again
			forgetNoteTitle(noteId);
			dispatchNoteEvent('note-deleted', { noteId, contractId: currentNote?.contractId });
			navigation.clearSelectedNote();
		} catch (deleteError) {
			console.error('Error deleting note:', deleteError);
			showHeaderMessage('Failed to delete note');
		}
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
		clearTimeout(headerMessageTimeout);
	});

	// Open whatever the navigation selects: an existing note, a fresh draft, or nothing.
	$effect(() => {
		const selectedNoteId = navigation.selectedNoteId;
		const selectedContractId = navigation.selectedContractId;
		const draftToken = noteDraft.token;
		const draftContractId = noteDraft.contractId;

		untrack(() => {
			if (selectedNoteId) {
				// A draft that was just created is already open under this ID
				if (editorSession?.noteId === selectedNoteId) return;
				void openExistingNote(selectedNoteId);
			} else if (draftContractId && draftContractId === selectedContractId) {
				void draftToken;
				openDraft(draftContractId);
			} else {
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
					onWikiLinkClick={(noteId) => noteNavigation.openNoteById(noteId)}
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
</div>
