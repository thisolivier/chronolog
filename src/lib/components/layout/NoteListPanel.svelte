<!--
	NoteListPanel - Panel 2 content for notes mode: one contract's notes, or one client's notes across
	its contracts (the client view, `/notes/client/<id>`, sprint 039-CL), pinned notes first; or every
	note (all notes, `/notes/all`, sprint 051-UI), newest first with pins not floated.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import NoteListRow from './NoteListRow.svelte';
	import NoteListNewNoteButton from './NoteListNewNoteButton.svelte';
	import { startNoteDraft, endNoteDraft } from '$lib/components/notes/note-draft.svelte';
	import { onNoteEvent } from '$lib/components/notes/note-events';
	import { sortNotes, loadSortPreference, saveSortPreference, type NoteSortOrder } from '$lib/components/notes/note-sort';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';
	import { ALL_NOTES_LABEL } from './navigation-labels';
	import type { NoteSummary } from '$lib/services/types';
	import { OUTBOX_REPLAYED_EVENT } from '$lib/offline/offline-session.svelte';
	import { OUTBOX_RESOLVED_EVENT } from '$lib/offline/outbox-resolve';

	const navigationContext = getNavigationContext();
	const dataService = getDataService();

	const MOVE_FEEDBACK_DURATION_MS = 4000;
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

	/** All notes (051-UI): every contract, newest first, pins not floated */
	let isAllNotesView = $derived(navigationContext.isAllNotesView);
	let sortedNotes = $derived(sortNotes(notesList, sortOrder, { floatPinned: !isAllNotesView }));
	let isDraftOpen = $derived(navigationContext.isDraftOpen);
	/** The client view's client (039-CL); null for a contract's list */
	let viewedClientId = $derived(navigationContext.listClientId);
	// Rule 4: the list names its client and contract (the sidebar may be collapsed or off screen)
	let contractLabel = $derived(
		navigationContext.selectedContractId ? contractDirectory.labels[navigationContext.selectedContractId] : undefined
	);
	let viewedClientName = $derived(contractDirectory.clientName(viewedClientId));
	// New Note in the client view: the client's active contracts (all of them if none is active);
	// in all notes, every active contract
	let clientContracts = $derived.by(() => {
		if (isAllNotesView) return contractDirectory.contracts.filter((contract) => !contractDirectory.isArchived(contract.id));
		const ofClient = contractDirectory.contractsOfClient(viewedClientId);
		const active = ofClient.filter((contract) => !contractDirectory.isArchived(contract.id));
		return active.length > 0 ? active : ofClient;
	});
	/** What the list shows: `all`, `contract:<id>`, `client:<id>`, or null */
	let listKey = $derived(
		isAllNotesView
			? 'all'
			: viewedClientId
			? `client:${viewedClientId}`
			: navigationContext.selectedContractId
				? `contract:${navigationContext.selectedContractId}`
				: null
	);

	function currentListKey(): string | null {
		return listKey;
	}

	/** True when a note of `contractId` belongs in the list on screen */
	function listShowsContract(contractId: string | undefined): boolean {
		if (!contractId) return false;
		if (isAllNotesView) return true;
		if (viewedClientId) return contractDirectory.labels[contractId]?.clientId === viewedClientId;
		return contractId === navigationContext.selectedContractId;
	}

	function loadNotesFor(key: string): Promise<NoteSummary[]> {
		if (key === 'all') return dataService.getAllNotes();
		const [kind, id] = key.split(':');
		return kind === 'client' ? dataService.getNotesForClient(id) : dataService.getNotesForContract(id);
	}

	/** Offline changes reached the server (new IDs, new previews): reload without a spinner */
	async function refreshNotesQuietly() {
		const key = currentListKey();
		if (!key) return;
		try {
			const loadedNotes = await loadNotesFor(key);
			if (currentListKey() === key) notesList = loadedNotes;
		} catch (error) {
			console.error('Error refreshing notes:', error);
		}
	}

	async function fetchNotes(key: string) {
		isLoading = true;
		fetchError = null;
		try {
			createdWhileLoading.clear();
			const loadedNotes = await loadNotesFor(key);
			if (currentListKey() === key) {
				const missing = [...createdWhileLoading.values()].filter(
					(created) => listShowsContract(created.contractId) && !loadedNotes.some((note) => note.id === created.id)
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
	function handleCreateNote(contractId: string) {
		const now = Date.now();
		if (now - lastNewNoteClick < NEW_NOTE_DEBOUNCE_MS) return;
		lastNewNoteClick = now;

		startNoteDraft(contractId);
		navigationContext.openDraft(contractId);
	}

	function handleNoteClick(note: NoteSummary) {
		endNoteDraft();
		navigationContext.selectNote(note.id, note.contractId);
	}

	/** Pin or unpin in place; the list re-sorts, the server keeps `updatedAt` (039-CL) */
	async function togglePin(note: NoteSummary) {
		const pinned = !note.isPinned;
		const setPinState = (isPinned: boolean, pinnedAt: string | null | undefined) => {
			notesList = notesList.map((entry) => (entry.id === note.id ? { ...entry, isPinned, pinnedAt } : entry));
		};
		setPinState(pinned, pinned ? new Date().toISOString() : null);
		try {
			const saved = await dataService.setNotePinned(note.id, pinned);
			setPinState(saved.isPinned, saved.pinnedAt);
		} catch (error) {
			console.error('Error pinning note:', error);
			setPinState(note.isPinned, note.pinnedAt);
		}
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

	// Re-fetch notes, and drop transient state, whenever the list's contract or client changes.
	// In the client view, opening a note changes the selected contract but not the list.
	$effect(() => {
		const key = listKey;
		untrack(() => {
			// A move switches to the destination contract; its message stays there only
			if (!listShowsContract(moveFeedbackContractId ?? undefined)) clearMoveFeedback();
			if (key) {
				void fetchNotes(key);
			} else {
				notesList = [];
			}
		});
	});

	onMount(() => {
		const unsubscribers = [
			onNoteEvent('note-created', (detail) => {
				if (!listShowsContract(detail.contractId)) return;
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
				const movedNote = notesList.find((note) => note.id === noteId);
				// In the client view a move to another of the client's contracts keeps the row
				notesList = listShowsContract(toContractId) && movedNote
					? notesList.map((note) => (note.id === noteId ? { ...note, contractId: toContractId } : note))
					: notesList.filter((note) => note.id !== noteId);
				const destinationLabel = [toClientName, toContractName].filter(Boolean).join(' / ');
				showMoveFeedback(destinationLabel ? `Moved to ${destinationLabel}` : 'Note moved', toContractId);
			}),
			onNoteEvent('note-deleted', ({ noteId }) => {
				notesList = notesList.filter((note) => note.id !== noteId);
			}),
			// Back from the trash (sprint 037-CL): reload this contract's list to show it in place
			onNoteEvent('note-restored', ({ contractId }) => {
				const key = currentListKey();
				if (key && listShowsContract(contractId)) void fetchNotes(key);
			})
		];
		const handleOutboxChange = () => void refreshNotesQuietly();
		for (const eventName of [OUTBOX_REPLAYED_EVENT, OUTBOX_RESOLVED_EVENT]) {
			window.addEventListener(eventName, handleOutboxChange);
			unsubscribers.push(() => window.removeEventListener(eventName, handleOutboxChange));
		}
		return () => {
			unsubscribers.forEach((unsubscribe) => unsubscribe());
			clearTimeout(moveFeedbackTimeout);
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
			title={isAllNotesView
				? 'All notes, newest first'
				: viewedClientId
				? `${viewedClientName ?? 'Client'} · all contracts`
				: contractLabel
					? `${contractLabel.clientName} · ${contractLabel.name}`
					: undefined}
		>
			{#if isAllNotesView}
				<p class="truncate text-xs text-stone-500">Every contract, newest first</p>
				<h2 class="truncate text-sm font-semibold text-stone-900">{ALL_NOTES_LABEL}</h2>
			{:else if viewedClientId}
				<p class="truncate text-xs text-stone-500">All contracts</p>
				<h2 class="truncate text-sm font-semibold text-stone-900">{viewedClientName ?? 'Notes'}</h2>
			{:else}
				<p class="truncate text-xs text-stone-500">{contractLabel?.clientName ?? 'Notes'}</p>
				<h2 class="truncate text-sm font-semibold text-stone-900">{contractLabel?.name ?? 'Notes'}</h2>
			{/if}
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
			<NoteListNewNoteButton
				contractId={viewedClientId || isAllNotesView ? null : navigationContext.selectedContractId}
				clientContracts={viewedClientId || isAllNotesView ? clientContracts : []}
				withClientNames={isAllNotesView}
				onCreate={handleCreateNote}
			/>
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
		{#if isLoading}
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
					<NoteListRow
						{note}
						isSelected={navigationContext.selectedNoteId === note.id}
						dateField={sortOrder === 'created' ? 'createdAt' : 'updatedAt'}
						contractName={isAllNotesView
							? contractDirectory.contextLabel(note.contractId)
							: viewedClientId
								? (contractDirectory.labels[note.contractId]?.name ?? null)
								: null}
						contractOnOwnLine={isAllNotesView}
						onOpen={handleNoteClick}
						onTogglePin={togglePin}
					/>
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
