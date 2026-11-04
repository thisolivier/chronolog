<!-- NoteListPanel - Panel 2 content for notes mode -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import { formatSmartDate } from '$lib/utils/format-date';
	import { startNoteDraft, endNoteDraft } from '$lib/components/notes/note-draft.svelte';
	import { onNoteEvent } from '$lib/components/notes/note-events';
	import { sortNotes, loadSortPreference, saveSortPreference, type NoteSortOrder } from '$lib/components/notes/note-sort';
	import NoteSearchResults from '$lib/components/notes/NoteSearchResults.svelte';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';
	import type { NoteSummary, NoteSearchResult } from '$lib/services/types';

	const navigationContext = getNavigationContext();
	const dataService = getDataService();

	const MOVE_FEEDBACK_DURATION_MS = 4000;
	const SEARCH_DEBOUNCE_MS = 200;
	const NEW_NOTE_DEBOUNCE_MS = 400;

	let notesList = $state<NoteSummary[]>([]);
	let isLoading = $state(false);
	let fetchError = $state<string | null>(null);
	let moveFeedback = $state<string | null>(null);
	/** The contract the move message belongs to (the moved note's new contract) */
	let moveFeedbackContractId: string | null = null;
	let moveFeedbackTimeout: ReturnType<typeof setTimeout> | undefined;
	let sortOrder = $state<NoteSortOrder>(loadSortPreference());
	let lastNewNoteClick = 0;
	/** Notes announced by `note-created`; kept if a list fetch started before they existed */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping only, never rendered
	const createdWhileLoading = new Map<string, NoteSummary>();

	let searchQuery = $state('');
	let searchResults = $state<NoteSearchResult[]>([]);
	let isSearching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchRequestCounter = 0;

	let sortedNotes = $derived(sortNotes(notesList, sortOrder));
	let isDraftOpen = $derived(navigationContext.isDraftOpen);
	// Rule 4: the list names its client and contract (the sidebar may be collapsed or off screen)
	let contractLabel = $derived(
		navigationContext.selectedContractId ? contractDirectory.labels[navigationContext.selectedContractId] : undefined
	);

	async function fetchNotesForContract(contractId: string) {
		isLoading = true;
		fetchError = null;
		try {
			createdWhileLoading.clear();
			const loadedNotes = await dataService.getNotesForContract(contractId);
			if (navigationContext.selectedContractId === contractId) {
				const missing = [...createdWhileLoading.values()].filter(
					(created) => created.contractId === contractId && !loadedNotes.some((note) => note.id === created.id)
				);
				notesList = [...missing, ...loadedNotes];
			}
		} catch (error) {
			fetchError = error instanceof Error ? error.message : 'An error occurred';
			console.error('Error loading notes:', error);
		} finally {
			isLoading = false;
		}
	}

	/**
	 * New Note opens an empty draft editor with focus; the note is only created once
	 * something is typed. Repeated clicks reuse the open draft.
	 */
	function handleCreateNote() {
		const contractId = navigationContext.selectedContractId;
		if (!contractId) return;
		const now = Date.now();
		if (now - lastNewNoteClick < NEW_NOTE_DEBOUNCE_MS) return;
		lastNewNoteClick = now;

		startNoteDraft(contractId);
		navigationContext.openDraft();
	}

	function handleNoteClick(noteId: string) {
		endNoteDraft();
		navigationContext.selectNote(noteId);
	}

	function toggleSortOrder() {
		sortOrder = sortOrder === 'modified' ? 'created' : 'modified';
		saveSortPreference(sortOrder);
	}

	function showMoveFeedback(message: string, contractId: string) {
		moveFeedback = message;
		moveFeedbackContractId = contractId;
		clearTimeout(moveFeedbackTimeout);
		moveFeedbackTimeout = setTimeout(() => {
			moveFeedback = null;
		}, MOVE_FEEDBACK_DURATION_MS);
	}

	function clearMoveFeedback() {
		moveFeedback = null;
		clearTimeout(moveFeedbackTimeout);
	}

	// -- Search across all contracts --

	function handleSearchInput() {
		clearTimeout(searchTimer);
		const query = searchQuery.trim();
		if (!query) {
			searchResults = [];
			isSearching = false;
			return;
		}
		isSearching = true;
		searchTimer = setTimeout(() => void runSearch(query), SEARCH_DEBOUNCE_MS);
	}

	async function runSearch(query: string) {
		const requestNumber = ++searchRequestCounter;
		try {
			const results = await dataService.searchNotes(query, { limit: 25 });
			if (requestNumber === searchRequestCounter) searchResults = results;
		} catch (error) {
			console.error('Error searching notes:', error);
			if (requestNumber === searchRequestCounter) searchResults = [];
		} finally {
			if (requestNumber === searchRequestCounter) isSearching = false;
		}
	}

	function clearSearch() {
		searchQuery = '';
		searchResults = [];
		isSearching = false;
		clearTimeout(searchTimer);
	}

	function openSearchResult(result: NoteSearchResult) {
		endNoteDraft();
		navigationContext.openNote(result.id, result.contractId, result.clientId);
	}

	// Re-fetch notes, and drop transient state, whenever the selected contract changes
	$effect(() => {
		const contractId = navigationContext.selectedContractId;
		untrack(() => {
			// A move switches to the destination contract; its message stays there only
			if (contractId !== moveFeedbackContractId) clearMoveFeedback();
			if (contractId) {
				void fetchNotesForContract(contractId);
			} else {
				notesList = [];
			}
		});
	});

	onMount(() => {
		const unsubscribers = [
			onNoteEvent('note-created', (detail) => {
				if (detail.contractId !== navigationContext.selectedContractId) return;
				const createdNote: NoteSummary = {
					id: detail.noteId,
					contractId: detail.contractId,
					isPinned: false,
					createdAt: detail.createdAt,
					updatedAt: detail.updatedAt,
					firstLine: detail.firstLine,
					secondLine: detail.secondLine
				};
				createdWhileLoading.set(detail.noteId, createdNote);
				if (notesList.some((note) => note.id === detail.noteId)) return;
				notesList = [createdNote, ...notesList];
			}),
			onNoteEvent('note-saved', ({ noteId, firstLine, secondLine, updatedAt }) => {
				const noteIndex = notesList.findIndex((note) => note.id === noteId);
				if (noteIndex !== -1) {
					notesList[noteIndex] = { ...notesList[noteIndex], firstLine, secondLine, updatedAt };
				}
			}),
			onNoteEvent('note-moved', ({ noteId, toContractId, toContractName, toClientName }) => {
				// The editor panel then opens the note under its new contract, so this list
				// reloads for that contract and the message is shown there.
				notesList = notesList.filter((note) => note.id !== noteId);
				const destinationLabel = [toClientName, toContractName].filter(Boolean).join(' / ');
				showMoveFeedback(destinationLabel ? `Moved to ${destinationLabel}` : 'Note moved', toContractId);
			}),
			onNoteEvent('note-deleted', ({ noteId }) => {
				notesList = notesList.filter((note) => note.id !== noteId);
			}),
			// Back from the trash (sprint 037-CL): reload this contract's list to show it in place
			onNoteEvent('note-restored', ({ contractId }) => {
				if (contractId === navigationContext.selectedContractId) void fetchNotesForContract(contractId);
			})
		];
		return () => {
			unsubscribers.forEach((unsubscribe) => unsubscribe());
			clearTimeout(moveFeedbackTimeout);
			clearTimeout(searchTimer);
		};
	});
</script>

<div class="flex h-full flex-col bg-stone-50">
	<!-- Header -->
	<!-- Rule 4: the client and contract on their own row, so long names are not squeezed by the actions -->
	<div class="border-b border-stone-200 bg-white px-4 pt-3 pb-2">
		<div
			class="min-w-0"
			data-testid="note-list-context"
			title={contractLabel ? `${contractLabel.clientName} · ${contractLabel.name}` : undefined}
		>
			<p class="truncate text-xs text-stone-500">{contractLabel?.clientName ?? 'Notes'}</p>
			<h2 class="truncate text-sm font-semibold text-stone-900">{contractLabel?.name ?? 'Notes'}</h2>
		</div>
		<div class="mt-2 flex items-center justify-between gap-2">
			<button
				type="button"
				onclick={toggleSortOrder}
				class="-ml-2 rounded px-2 py-1 text-xs whitespace-nowrap text-stone-500 hover:bg-stone-100 hover:text-stone-700"
				title="Change sort order"
				data-testid="note-sort-toggle"
			>
				{sortOrder === 'modified' ? 'Modified ↓' : 'Created ↓'}
			</button>
			<button
				type="button"
				onclick={handleCreateNote}
				disabled={!navigationContext.selectedContractId}
				class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700
					disabled:cursor-not-allowed disabled:opacity-50"
			>
				New Note
			</button>
		</div>
	</div>

	<!-- Search across all contracts -->
	<div class="border-b border-stone-200 bg-white px-3 py-2">
		<div class="relative">
			<input
				type="text"
				role="searchbox"
				bind:value={searchQuery}
				oninput={handleSearchInput}
				onkeydown={(event) => event.key === 'Escape' && clearSearch()}
				placeholder="Search all notes"
				aria-label="Search all notes"
				data-testid="note-search-input"
				class="w-full rounded-md border border-stone-200 bg-stone-50 py-1.5 pl-2.5 pr-7 text-sm text-stone-800 placeholder:text-stone-400 focus:border-blue-400 focus:bg-white focus:outline-none"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={clearSearch}
					class="absolute right-1.5 top-1/2 -translate-y-1/2 px-1 text-stone-400 hover:text-stone-600"
					aria-label="Clear search"
				>
					&times;
				</button>
			{/if}
		</div>
	</div>

	<!-- Transient confirmation after a note is moved to another contract -->
	{#if moveFeedback}
		<div
			role="status"
			data-testid="move-feedback"
			class="border-b border-green-200 bg-green-50 px-4 py-2 text-xs text-green-700"
		>
			{moveFeedback}
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto">
		{#if searchQuery.trim()}
			<NoteSearchResults
				results={searchResults}
				{isSearching}
				selectedNoteId={navigationContext.selectedNoteId}
				onOpen={openSearchResult}
			/>
		{:else if isLoading}
			<div class="flex items-center justify-center py-8">
				<div class="text-sm text-stone-500">Loading notes...</div>
			</div>
		{:else if fetchError}
			<div class="mx-4 mt-4 rounded-md bg-red-50 p-4">
				<p class="text-sm text-red-800">{fetchError}</p>
			</div>
		{:else}
			<div class="divide-y divide-stone-200">
				{#if isDraftOpen}
					<div class="border-l-2 border-blue-600 bg-blue-50 px-4 py-3" data-testid="draft-note-row">
						<div class="text-sm font-semibold text-stone-500 italic">New note</div>
						<div class="text-xs text-stone-400">Not saved until you type</div>
					</div>
				{/if}
				{#each sortedNotes as note (note.id)}
					{@const isSelected = navigationContext.selectedNoteId === note.id}
					<button
						onclick={() => handleNoteClick(note.id)}
						class="block w-full text-left transition-colors hover:bg-stone-100
							{isSelected ? 'border-l-2 border-blue-600 bg-blue-50' : 'border-l-2 border-transparent'}"
					>
						<div class="px-4 py-3">
							<div class="mb-0.5 flex items-center gap-1.5">
								{#if note.isPinned}
									<span class="text-xs text-amber-500" title="Pinned">&#128204;</span>
								{/if}
								<span class="truncate text-sm font-semibold text-stone-900">
									{note.firstLine || 'Untitled'}
								</span>
							</div>
							<div class="truncate text-xs text-stone-500">
								<span class="font-medium">
									{formatSmartDate(sortOrder === 'created' ? note.createdAt : note.updatedAt)}
								</span>
								{#if note.secondLine}
									<span class="ml-1.5 text-stone-400">{note.secondLine}</span>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
			{#if notesList.length === 0 && !isDraftOpen}
				<div class="flex flex-col items-center justify-center px-4 py-8 text-center">
					<div class="text-sm text-stone-500">No notes yet</div>
					<p class="mt-1 text-xs text-stone-400">Create a note to start writing.</p>
				</div>
			{/if}
		{/if}
	</div>
</div>
