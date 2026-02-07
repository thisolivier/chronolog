<!-- NoteListPanel - Panel 2 content for notes mode -->
<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';

	type NoteListItem = {
		id: string;
		title: string | null;
		contractId: string;
		wordCount: number;
		isPinned: boolean;
		createdAt: string;
		updatedAt: string;
	};

	const navigationContext = getNavigationContext();

	let notesList = $state<NoteListItem[]>([]);
	let isLoading = $state(false);
	let isCreating = $state(false);
	let fetchError = $state<string | null>(null);

	/**
	 * Format a date string as a relative time (e.g., "2 hours ago", "3 days ago")
	 * or as a short date for older entries.
	 */
	function formatRelativeDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const differenceInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (differenceInSeconds < 60) return 'just now';
		if (differenceInSeconds < 3600) {
			const minutes = Math.floor(differenceInSeconds / 60);
			return `${minutes}m ago`;
		}
		if (differenceInSeconds < 86400) {
			const hours = Math.floor(differenceInSeconds / 3600);
			return `${hours}h ago`;
		}
		if (differenceInSeconds < 604800) {
			const days = Math.floor(differenceInSeconds / 86400);
			return `${days}d ago`;
		}

		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/**
	 * Fetch notes for the currently selected contract.
	 */
	async function fetchNotesForContract(contractId: string) {
		isLoading = true;
		fetchError = null;

		try {
			const response = await fetch(`/api/notes?contractId=${encodeURIComponent(contractId)}`);
			if (!response.ok) {
				throw new Error('Failed to load notes');
			}

			const data = await response.json();
			notesList = data.notes ?? [];
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
			const response = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId })
			});

			if (!response.ok) {
				throw new Error('Failed to create note');
			}

			const data = await response.json();
			const createdNote = data.note;

			// Prepend the new note to the list (it will appear at the top)
			notesList = [createdNote, ...notesList];

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
</script>

<div class="flex h-full flex-col bg-gray-50">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
		<h2 class="text-sm font-semibold text-gray-900">Notes</h2>
		<button
			onclick={handleCreateNote}
			disabled={isCreating || !navigationContext.selectedContractId}
			class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700
				disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isCreating ? 'Creating...' : 'New Note'}
		</button>
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
				<p class="mt-1 text-xs text-gray-400">
					Create a note to start writing.
				</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-200">
				{#each notesList as note (note.id)}
					{@const isSelected = navigationContext.selectedNoteId === note.id}
					<button
						onclick={() => handleNoteClick(note.id)}
						class="block w-full text-left transition-colors hover:bg-gray-100
							{isSelected ? 'border-l-2 border-blue-600 bg-blue-50' : 'border-l-2 border-transparent'}"
					>
						<div class="px-4 py-3">
							<!-- Title row with pin indicator -->
							<div class="mb-1 flex items-center gap-1.5">
								{#if note.isPinned}
									<span class="text-xs text-amber-500" title="Pinned">&#128204;</span>
								{/if}
								<span class="truncate text-sm font-medium text-gray-900">
									{note.title || 'Untitled'}
								</span>
							</div>

							<!-- Metadata row: date and word count -->
							<div class="flex items-center gap-2 text-xs text-gray-500">
								<span>{formatRelativeDate(note.updatedAt)}</span>
								<span class="text-gray-300">&middot;</span>
								<span>{note.wordCount} {note.wordCount === 1 ? 'word' : 'words'}</span>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
