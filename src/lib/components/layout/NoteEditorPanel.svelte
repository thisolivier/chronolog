<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import NoteEditor from '$lib/components/notes/NoteEditor.svelte';
	import LinkedTimeEntries from '$lib/components/notes/LinkedTimeEntries.svelte';
	import AttachmentList from '$lib/components/notes/AttachmentList.svelte';
	import { buildChronologUrl } from '$lib/components/notes/extensions/attachment-resolver.js';
	import { extractPreviewLines } from '$lib/utils/extract-preview-lines';

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
	let backlinks = $state<Array<{ sourceNoteId: string; noteTitle: string | null; headingAnchor: string | null }>>([]);

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
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'Unknown error loading note';
			console.error('Error fetching note:', error);
		} finally {
			isLoading = false;
		}
	}

	/** Fetch backlinks for a note from the API */
	async function fetchBacklinks(noteId: string) {
		try {
			const response = await fetch(`/api/notes/${noteId}/backlinks`);
			if (!response.ok) {
				backlinks = [];
				return;
			}
			const data = await response.json();
			backlinks = data.backlinks ?? [];
		} catch (backlinkError) {
			console.error('Error fetching backlinks:', backlinkError);
			backlinks = [];
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

			// Notify the notes list panel to update this note's preview
			const preview = extractPreviewLines(saveData.contentJson);
			window.dispatchEvent(
				new CustomEvent('note-saved', {
					detail: {
						noteId,
						firstLine: preview.firstLine,
						secondLine: preview.secondLine,
						updatedAt: data.note.updatedAt
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
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch(`/api/notes/${noteId}/attachments`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('Upload failed:', errorData);
				return null;
			}

			const data = await response.json();
			return buildChronologUrl(data.attachment.id);
		} catch (uploadError) {
			console.error('Error uploading file:', uploadError);
			return null;
		}
	}

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
			<div class="border-t border-gray-200 bg-white px-6 py-3">
				<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Linked from</h4>
				<div class="flex flex-wrap gap-2">
					{#each backlinks as backlink (backlink.sourceNoteId)}
						<button
							onclick={() => navigation.selectNote(backlink.sourceNoteId)}
							class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-mono text-indigo-700 hover:bg-indigo-100"
						>
							{backlink.sourceNoteId}
							{#if backlink.noteTitle}
								<span class="font-sans text-gray-500">&middot; {backlink.noteTitle}</span>
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
