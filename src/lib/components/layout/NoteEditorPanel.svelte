<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import NoteEditor from '$lib/components/notes/NoteEditor.svelte';

	type NoteData = {
		id: string;
		title: string | null;
		content: string | null;
		contentJson: string | null;
		contractId: string;
		wordCount: number;
		isPinned: boolean;
		createdAt: string;
		updatedAt: string;
	};

	const navigation = getNavigationContext();

	let currentNote = $state<NoteData | null>(null);
	let isLoading = $state(false);
	let fetchError = $state<string | null>(null);
	let lastSavedAt = $state<Date | null>(null);

	/** Fetch the full note from the API */
	async function fetchNote(noteId: string) {
		isLoading = true;
		fetchError = null;
		currentNote = null;

		try {
			const response = await fetch(`/api/notes/${noteId}`);
			if (!response.ok) {
				throw new Error(`Failed to load note (${response.status})`);
			}
			const data = await response.json();
			currentNote = data.note;
			lastSavedAt = null;
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'Unknown error loading note';
			console.error('Error fetching note:', error);
		} finally {
			isLoading = false;
		}
	}

	/** Save note content via PUT API */
	async function handleSave(saveData: { title: string; content: string; contentJson: string }) {
		const noteId = navigation.selectedNoteId;
		if (!noteId) return;

		try {
			const response = await fetch(`/api/notes/${noteId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: saveData.title,
					content: saveData.content,
					contentJson: saveData.contentJson
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save note');
			}

			const data = await response.json();
			currentNote = data.note;
			lastSavedAt = new Date();
		} catch (error) {
			console.error('Error saving note:', error);
		}
	}

	/** Delete the current note after confirmation */
	async function handleDelete() {
		const noteId = navigation.selectedNoteId;
		if (!noteId) return;

		const confirmed = window.confirm('Are you sure you want to delete this note? This cannot be undone.');
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
			if (!response.ok) {
				throw new Error('Failed to delete note');
			}
			navigation.clearSelectedNote();
		} catch (error) {
			console.error('Error deleting note:', error);
			alert('Failed to delete note. Please try again.');
		}
	}

	/** Format a Date as a short human-readable timestamp */
	function formatTimestamp(date: Date): string {
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	// Re-fetch when selected note changes
	$effect(() => {
		const selectedNoteId = navigation.selectedNoteId;
		if (selectedNoteId) {
			fetchNote(selectedNoteId);
		} else {
			currentNote = null;
			fetchError = null;
			lastSavedAt = null;
		}
	});
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-50">
	{#if !navigation.selectedNoteId}
		<!-- Empty state -->
		<div class="flex flex-1 items-center justify-center">
			<p class="text-gray-400">Select a note to view</p>
		</div>
	{:else if isLoading}
		<!-- Loading state -->
		<div class="flex flex-1 items-center justify-center">
			<p class="text-gray-500">Loading note...</p>
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
		<!-- Header bar -->
		<div class="border-b border-gray-200 bg-white px-6 py-3">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="font-mono text-xs text-gray-400">{currentNote.id}</span>
					{#if lastSavedAt}
						<span class="text-xs text-gray-400">
							Saved at {formatTimestamp(lastSavedAt)}
						</span>
					{/if}
				</div>
				<button
					onclick={handleDelete}
					class="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
				>
					Delete
				</button>
			</div>
		</div>

		<!-- Editor (re-mount on note change) -->
		<div class="flex-1 overflow-hidden">
			{#key currentNote.id}
				<NoteEditor
					initialContent={currentNote.content ?? ''}
					initialJson={currentNote.contentJson ?? ''}
					noteTitle={currentNote.title ?? ''}
					onSave={handleSave}
				/>
			{/key}
		</div>
	{/if}
</div>
