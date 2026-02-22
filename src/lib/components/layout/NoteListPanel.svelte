<!-- NoteListPanel - Panel 2 content for notes mode -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import { formatSmartDate } from '$lib/utils/format-date';
	import type { NoteSummary } from '$lib/services/types';

	const navigationContext = getNavigationContext();
	const dataService = getDataService();

	let notesList = $state<NoteSummary[]>([]);
	let isLoading = $state(false);
	let isCreating = $state(false);
	let fetchError = $state<string | null>(null);

	/**
	 * Fetch notes for the currently selected contract.
	 */
	async function fetchNotesForContract(contractId: string) {
		isLoading = true;
		fetchError = null;

		try {
			notesList = await dataService.getNotesForContract(contractId);
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'An error occurred';
			console.error('Error loading notes:', error);
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Create a new note for the selected contract, then select it.
	 */
	async function handleCreateNote() {
		const contractId = navigationContext.selectedContractId;
		if (!contractId || isCreating) return;

		isCreating = true;
		fetchError = null;

		try {
			const createdNote = await dataService.createNote(contractId);

			// Prepend the new note to the list (it will appear at the top)
			notesList = [
				{
					...createdNote,
					firstLine: '',
					secondLine: ''
				},
				...notesList
			];

			// Select the newly created note
			navigationContext.selectNote(createdNote.id);
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'Failed to create note';
			console.error('Error creating note:', error);
		} finally {
			isCreating = false;
		}
	}

	/**
	 * Delete the currently selected note.
	 */
	async function handleDeleteSelectedNote() {
		const noteId = navigationContext.selectedNoteId;
		if (!noteId) return;

		const confirmed = window.confirm(
			'Are you sure you want to delete this note? This cannot be undone.'
		);
		if (!confirmed) return;

		try {
			await dataService.deleteNote(noteId);

			// Remove from local list
			notesList = notesList.filter((note) => note.id !== noteId);

			// Clear selection
			navigationContext.clearSelectedNote();
		} catch (error) {
			console.error('Error deleting note:', error);
			alert('Failed to delete note. Please try again.');
		}
	}

	/**
	 * Handle clicking a note in the list.
	 */
	function handleNoteClick(noteId: string) {
		navigationContext.selectNote(noteId);
	}

	// Re-fetch notes whenever the selected contract changes
	$effect(() => {
		const contractId = navigationContext.selectedContractId;
		if (contractId) {
			fetchNotesForContract(contractId);
		} else {
			notesList = [];
		}
	});

	/** Handle note-saved events from NoteEditorPanel — update preview in-place */
	function handleNoteSaved(event: Event) {
		const { noteId, firstLine, secondLine, updatedAt } = (event as CustomEvent).detail;
		const noteIndex = notesList.findIndex((note) => note.id === noteId);
		if (noteIndex !== -1) {
			notesList[noteIndex] = {
				...notesList[noteIndex],
				firstLine,
				secondLine,
				updatedAt
			};
		}
	}

	onMount(() => {
		window.addEventListener('note-saved', handleNoteSaved);
	});

	onDestroy(() => {
		window.removeEventListener('note-saved', handleNoteSaved);
	});
</script>

<div class="flex h-full flex-col bg-gray-50">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
		<h2 class="text-sm font-semibold text-gray-900">Notes</h2>
		<div class="flex items-center gap-2">
			{#if navigationContext.selectedNoteId}
				<button
					onclick={handleDeleteSelectedNote}
					class="rounded-md px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
					title="Delete selected note"
				>
					Delete
				</button>
			{/if}
			<button
				onclick={handleCreateNote}
				disabled={isCreating || !navigationContext.selectedContractId}
				class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700
					disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isCreating ? 'Creating...' : 'New Note'}
			</button>
		</div>
	</div>

	<!-- Note list -->
	<div class="flex-1 overflow-y-auto">
		{#if isLoading}
			<div class="flex items-center justify-center py-8">
				<div class="text-sm text-gray-500">Loading notes...</div>
			</div>
		{:else if fetchError}
			<div class="mx-4 mt-4 rounded-md bg-red-50 p-4">
				<p class="text-sm text-red-800">{fetchError}</p>
			</div>
		{:else if notesList.length === 0}
			<div class="flex flex-col items-center justify-center px-4 py-8 text-center">
				<div class="text-sm text-gray-500">No notes yet</div>
				<p class="mt-1 text-xs text-gray-400">Create a note to start writing.</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-200">
				{#each notesList as note (note.id)}
					{@const isSelected = navigationContext.selectedNoteId === note.id}
					<button
						onclick={() => handleNoteClick(note.id)}
						class="block w-full text-left transition-colors hover:bg-gray-100
							{isSelected
							? 'border-l-2 border-blue-600 bg-blue-50'
							: 'border-l-2 border-transparent'}"
					>
						<div class="px-4 py-3">
							<!-- First line: bold truncated title -->
							<div class="mb-0.5 flex items-center gap-1.5">
								{#if note.isPinned}
									<span class="text-xs text-amber-500" title="Pinned">&#128204;</span>
								{/if}
								<span class="truncate text-sm font-semibold text-gray-900">
									{note.firstLine || 'Untitled'}
								</span>
							</div>

							<!-- Second line: date prefix + second content line -->
							<div class="truncate text-xs text-gray-500">
								<span class="font-medium">{formatSmartDate(note.updatedAt)}</span>
								{#if note.secondLine}
									<span class="ml-1.5 text-gray-400">{note.secondLine}</span>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
