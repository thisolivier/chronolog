<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import NoteEditor from '$lib/components/notes/NoteEditor.svelte';
	import LinkedTimeEntries from '$lib/components/notes/LinkedTimeEntries.svelte';
	import AttachmentList from '$lib/components/notes/AttachmentList.svelte';
	import { buildChronologUrl } from '$lib/components/notes/extensions/attachment-resolver.js';
	import { exportAsMarkdown, exportAsPdf } from '$lib/components/notes/note-export';
	import '$lib/components/notes/print-styles.css';
	import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
	import type { NoteDetail, Backlink, ContractOption } from '$lib/services/types';

	const navigation = getNavigationContext();
	const dataService = getDataService();

	let currentNote = $state<NoteDetail | null>(null);
	let isLoading = $state(false);
	let fetchError = $state<string | null>(null);
	let backlinks = $state<Backlink[]>([]);
	let showExportMenu = $state(false);
	let showMoveMenu = $state(false);
	let moveContracts = $state<ContractOption[]>([]);
	let moveMessage = $state<string | null>(null);
	let moveMessageTimeout: ReturnType<typeof setTimeout> | undefined;

	/** Detail payload of the window `note-moved` event consumed by NoteListPanel */
	interface NoteMovedEventDetail {
		noteId: string;
		fromContractId: string | undefined;
		toContractId: string;
		toContractName: string | null;
		toClientName: string | null;
	}

	/** Close dropdown on outside click — reused for both menus */
	function closeOnOutsideClick(selector: string, closeFn: () => void) {
		const handleClick = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest(selector)) {
				closeFn();
			}
		};
		setTimeout(() => document.addEventListener('click', handleClick), 0);
		return () => document.removeEventListener('click', handleClick);
	}

	$effect(() => {
		if (showExportMenu) {
			return closeOnOutsideClick('[data-export-menu]', () => { showExportMenu = false; });
		}
	});

	$effect(() => {
		if (showMoveMenu) {
			return closeOnOutsideClick('[data-move-menu]', () => { showMoveMenu = false; });
		}
	});

	/** Fetch the full note via DataService */
	async function fetchNote(noteId: string) {
		isLoading = true;
		fetchError = null;
		currentNote = null;

		try {
			currentNote = await dataService.getNoteById(noteId);
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'Unknown error loading note';
			console.error('Error fetching note:', error);
		} finally {
			isLoading = false;
		}
	}

	/** Fetch backlinks for a note via DataService */
	async function fetchBacklinks(noteId: string) {
		try {
			backlinks = await dataService.getNoteBacklinks(noteId);
		} catch (backlinkError) {
			console.error('Error fetching backlinks:', backlinkError);
			backlinks = [];
		}
	}

	/** Save note content via DataService */
	async function handleSave(saveData: { title: string; content: string; contentJson: string }) {
		const noteId = navigation.selectedNoteId;
		if (!noteId) return;

		try {
			const updatedNote = await dataService.updateNote(noteId, {
				title: saveData.title,
				content: saveData.content,
				contentJson: saveData.contentJson
			});

			currentNote = updatedNote;

			// Notify the notes list panel to update this note's preview
			const preview = extractPreviewLines(saveData.contentJson);
			window.dispatchEvent(
				new CustomEvent('note-saved', {
					detail: {
						noteId,
						firstLine: preview.firstLine,
						secondLine: preview.secondLine,
						updatedAt: updatedNote.updatedAt
					}
				})
			);
		} catch (error) {
			console.error('Error saving note:', error);
		}
	}

	/** Upload a file as an attachment and return a chronolog:// URL */
	async function handleFileUpload(file: File): Promise<string | null> {
		const noteId = navigation.selectedNoteId;
		if (!noteId) return null;

		try {
			const result = await dataService.uploadAttachment(noteId, file);
			return buildChronologUrl(result.id);
		} catch (uploadError) {
			console.error('Error uploading file:', uploadError);
			return null;
		}
	}

	/** Open the move menu, fetching available contracts */
	async function toggleMoveMenu() {
		if (showMoveMenu) {
			showMoveMenu = false;
			return;
		}
		try {
			const allContracts = await dataService.getContracts();
			// Exclude the note's current contract
			moveContracts = allContracts.filter(
				(contract) => contract.id !== currentNote?.contractId
			);
			showMoveMenu = true;
		} catch (contractError) {
			console.error('Error loading contracts:', contractError);
		}
	}

	/** Move the current note to a different contract */
	async function handleMoveToContract(targetContractId: string) {
		const noteId = navigation.selectedNoteId;
		if (!noteId) return;

		const previousContractId = currentNote?.contractId;

		// Resolve the target contract so the list panel can name it in its confirmation
		const targetContract = moveContracts.find((contract) => contract.id === targetContractId);

		try {
			const updatedNote = await dataService.updateNote(noteId, { contractId: targetContractId });
			currentNote = updatedNote;
			showMoveMenu = false;

			// Notify the notes list: it removes the note from the current contract view,
			// clears the selection (which unmounts this header) and shows the success message.
			window.dispatchEvent(
				new CustomEvent<NoteMovedEventDetail>('note-moved', {
					detail: {
						noteId,
						fromContractId: previousContractId,
						toContractId: targetContractId,
						toContractName: targetContract?.name ?? null,
						toClientName: targetContract?.clientName ?? null
					}
				})
			);
		} catch (moveError) {
			// The editor stays mounted on failure, so the header is a visible place for the error
			console.error('Error moving note:', moveError);
			moveMessage = 'Failed to move note';
			clearTimeout(moveMessageTimeout);
			moveMessageTimeout = setTimeout(() => { moveMessage = null; }, 3000);
		}
	}

	onDestroy(() => {
		clearTimeout(moveMessageTimeout);
	});

	// Re-fetch when selected note changes
	$effect(() => {
		const selectedNoteId = navigation.selectedNoteId;
		if (selectedNoteId) {
			fetchNote(selectedNoteId);
			fetchBacklinks(selectedNoteId);
		} else {
			currentNote = null;
			fetchError = null;
			backlinks = [];
		}
	});
</script>

<div class="flex h-full flex-col overflow-hidden bg-stone-50">
	{#if !navigation.selectedNoteId}
		<!-- Empty state -->
		<div class="flex flex-1 items-center justify-center">
			<p class="text-stone-400">Select a note to view</p>
		</div>
	{:else if isLoading}
		<!-- Loading state -->
		<div class="flex flex-1 items-center justify-center">
			<p class="text-stone-500">Loading note...</p>
		</div>
	{:else if fetchError}
		<!-- Error state -->
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<p class="text-red-600">{fetchError}</p>
				<button
					onclick={() => navigation.selectedNoteId && fetchNote(navigation.selectedNoteId)}
					class="mt-2 text-sm text-blue-600 hover:text-blue-800"
				>
					Try again
				</button>
			</div>
		</div>
	{:else if currentNote}
		<!-- Note header with export actions -->
		<div class="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2">
			<div class="flex items-center gap-2">
				<span class="text-xs font-mono text-stone-400">{currentNote.id}</span>
				{#if moveMessage}
					<span role="status" class="text-xs text-red-600">{moveMessage}</span>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<!-- Move to... dropdown -->
				<div class="relative" data-move-menu>
					<button
						type="button"
						onclick={toggleMoveMenu}
						class="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
					>
						Move ▾
					</button>
					{#if showMoveMenu}
						<div class="absolute right-0 top-full z-10 mt-1 w-56 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
							{#if moveContracts.length === 0}
								<span class="block px-3 py-1.5 text-sm text-stone-400">No other contracts</span>
							{:else}
								{#each moveContracts as contract (contract.id)}
									<button
										type="button"
										onclick={() => handleMoveToContract(contract.id)}
										class="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100"
									>
										<span class="font-medium">{contract.clientName}</span>
										<span class="text-stone-400"> / </span>
										{contract.name}
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
				<!-- Export dropdown -->
				<div class="relative" data-export-menu>
				<button
					type="button"
					onclick={() => { showExportMenu = !showExportMenu; }}
					class="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
				>
					Export ▾
				</button>
				{#if showExportMenu}
					<div class="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
						<button
							type="button"
							onclick={() => { exportAsMarkdown(currentNote?.title ?? null, currentNote?.content ?? null); showExportMenu = false; }}
							class="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100"
						>
							Export as Markdown
						</button>
						<button
							type="button"
							onclick={() => { exportAsPdf(); showExportMenu = false; }}
							class="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100"
						>
							Export as PDF
						</button>
					</div>
				{/if}
				</div>
			</div>
		</div>

		<!-- Editor (re-mount on note change) -->
		<div class="flex-1 overflow-hidden">
			{#key currentNote.id}
				<NoteEditor
					initialContent={currentNote.content ?? ''}
					initialJson={currentNote.contentJson ?? ''}
					noteId={currentNote.id}
					onSave={handleSave}
					onFileUpload={handleFileUpload}
					onWikiLinkClick={(noteId) => navigation.selectNote(noteId)}
				/>
			{/key}
		</div>

		{#if backlinks.length > 0}
			<div class="border-t border-stone-200 bg-white px-6 py-3">
				<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Linked from</h4>
				<div class="flex flex-wrap gap-2">
					{#each backlinks as backlink (backlink.sourceNoteId)}
						<button
							onclick={() => navigation.selectNote(backlink.sourceNoteId)}
							class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-mono text-indigo-700 hover:bg-indigo-100"
						>
							{backlink.sourceNoteId}
							{#if backlink.noteTitle}
								<span class="font-sans text-stone-500">&middot; {backlink.noteTitle}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<LinkedTimeEntries noteId={currentNote.id} />
		<AttachmentList noteId={currentNote.id} />
	{/if}
</div>
