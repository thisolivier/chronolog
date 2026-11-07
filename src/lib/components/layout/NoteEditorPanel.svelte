<script lang="ts">
	import FindBar from '$lib/components/find/FindBar.svelte';
	/**
	 * The note editor panel: one NoteEditor per editor session, with header, backlinks, linked
	 * time entries and attachments (`NoteLinkedPanels`, collapsed on a short landscape phone). Split in sprint 043-CL: what it shows lives in `NotePanelState`
	 * (`notes/note-panel-state.svelte.ts`), saving in `notes/note-editor-session.ts`, the header
	 * actions in `notes/note-panel-actions.ts`, and the Undo toast in the workspace-level
	 * `NoteTrashToastHost` so it survives this panel unmounting (phone).
	 */
	import { onDestroy, onMount, untrack } from 'svelte';
	import { OFFLINE_ID_REMAPPED_EVENT } from '$lib/offline/offline-session.svelte';
	import { OUTBOX_RESOLVED_EVENT } from '$lib/offline/outbox-resolve';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import NoteEditor from '$lib/components/notes/NoteEditor.svelte';
	import NoteEditorHeader from '$lib/components/notes/NoteEditorHeader.svelte';
	import NoteLinkedPanels from '$lib/components/notes/NoteLinkedPanels.svelte';
	import { noteDraft } from '$lib/components/notes/note-draft.svelte';
	import { requestNoteTitles } from '$lib/components/notes/note-titles.svelte';
	import { useNoteNavigation } from '$lib/components/notes/note-navigation';
	import { NotePanelState } from '$lib/components/notes/note-panel-state.svelte';
	import { createNotePanelActions } from '$lib/components/notes/note-panel-actions';
	import '$lib/components/notes/print-styles.css';

	const navigation = getNavigationContext();
	const noteNavigation = useNoteNavigation(navigation);
	const panel = new NotePanelState(getDataService(), navigation);

	let headerMessage = $state<string | null>(null);
	let headerMessageTimeout: ReturnType<typeof setTimeout> | undefined;
	let editorComponent = $state<{ flushPendingSave: () => Promise<void> } | null>(null);

	function showHeaderMessage(message: string) {
		headerMessage = message;
		clearTimeout(headerMessageTimeout);
		headerMessageTimeout = setTimeout(() => {
			headerMessage = null;
		}, 3000);
	}

	const actions = createNotePanelActions({
		panel,
		noteNavigation,
		getEditor: () => editorComponent,
		showMessage: showHeaderMessage
	});

	// Offline outbox (sprint 045-CL): a note made offline got its real ID; a held change was settled
	const handleNoteRemapped = (event: Event) => {
		const { tempId, realId, type } = (event as CustomEvent<{ tempId: string; realId: string; type: string }>).detail;
		if (type === 'note') panel.handleNoteRemapped(tempId, realId);
	};
	const handleOutboxResolved = (event: Event) =>
		panel.handleOutboxResolved((event as CustomEvent<{ type: string; id: string; choice: string }>).detail);
	onMount(() => {
		window.addEventListener(OFFLINE_ID_REMAPPED_EVENT, handleNoteRemapped);
		window.addEventListener(OUTBOX_RESOLVED_EVENT, handleOutboxResolved);
		return () => {
			window.removeEventListener(OFFLINE_ID_REMAPPED_EVENT, handleNoteRemapped);
			window.removeEventListener(OUTBOX_RESOLVED_EVENT, handleOutboxResolved);
		};
	});

	onDestroy(() => {
		clearTimeout(headerMessageTimeout);
		panel.destroy();
	});

	// Open whatever the URL selects: an existing note, a draft (`/notes/<contract>/new`), or nothing.
	$effect(() => {
		const selection = {
			selectedNoteId: navigation.selectedNoteId,
			selectedContractId: navigation.selectedContractId,
			isDraftRoute: navigation.isDraftOpen,
			draftToken: noteDraft.token,
			draftContractId: noteDraft.contractId
		};
		untrack(() => panel.showUrlSelection(selection));
	});

	// Titles for the "Linked from" chips are also needed by wiki-links elsewhere
	$effect(() => {
		requestNoteTitles(panel.backlinks.map((backlink) => backlink.sourceNoteId));
	});
</script>

<div class="flex h-full flex-col overflow-y-auto bg-chalk-50">
	<FindBar mode="editor" />
	{#if panel.isLoading}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-ink-faint">Loading note...</p>
		</div>
	{:else if panel.fetchError}
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<p class="text-rust-600">{panel.fetchError}</p>
				<button
					onclick={() => navigation.selectedNoteId && panel.openExistingNote(navigation.selectedNoteId)}
					class="mt-2 text-sm text-pine-600 hover:text-pine-800"
				>
					Try again
				</button>
			</div>
		</div>
	{:else if panel.editorSession}
		{@const session = panel.editorSession}
		<NoteEditorHeader
			noteId={panel.activeNoteId}
			contractId={panel.currentNote?.contractId ?? session.contractId}
			saveStatus={panel.saveStatus}
			message={headerMessage}
			onMove={actions.moveToContract}
			onExportMarkdown={actions.exportMarkdown}
			onExportPdf={actions.exportPdf}
			onDelete={actions.deleteNote}
			onReload={() => session.noteId && panel.openExistingNote(session.noteId)}
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
					onFileUpload={actions.uploadFile}
					onWikiLinkClick={(noteId, _headingAnchor, element) => actions.followWikiLink(noteId, element)}
				/>
			{/key}
		</div>

		{#if panel.activeNoteId}
			<NoteLinkedPanels
				noteId={panel.activeNoteId}
				backlinks={panel.backlinks}
				onOpenBacklink={(backlink) => noteNavigation.openBacklink(backlink)}
			/>
		{/if}
	{:else}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-ink-faint">Select a note to view</p>
		</div>
	{/if}
</div>
