<!--
	TrashList — the trashed notes on the trash page (sprint 043-CL): title (or ID), contract, deleted
	date and days left before the 30-day purge, and a Restore button per row. A restored row says so
	and offers to open the note in the workspace.
-->
<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { restoreTrashedNote } from './note-trash';
	import { formatDeletedDate, purgeLabel, type TrashedNote } from './trash-view';

	let { notes }: { notes: TrashedNote[] } = $props();

	const dataService = getDataService();
	const navigation = getNavigationContext();

	/** Per note: restoring, restored (with its contract now), or the error */
	let rowStates = $state<Record<string, { status: 'restoring' | 'restored' | 'failed'; contractId?: string }>>({});

	async function restore(note: TrashedNote) {
		rowStates[note.id] = { status: 'restoring' };
		try {
			const restored = await restoreTrashedNote(dataService, note.id);
			rowStates[note.id] = { status: 'restored', contractId: restored.note.contractId };
		} catch (restoreError) {
			console.error('Could not restore note:', restoreError);
			rowStates[note.id] = { status: 'failed' };
		}
	}

	function openRestored(note: TrashedNote) {
		navigation.openNote(note.id, rowStates[note.id]?.contractId ?? note.contractId, '');
	}
</script>

<ul class="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white" data-testid="trash-list">
	{#each notes as note (note.id)}
		{@const rowState = rowStates[note.id]}
		<li class="flex items-center gap-3 px-3 py-2.5 sm:px-4" data-testid="trash-row" data-note-id={note.id}>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium {rowState?.status === 'restored' ? 'text-stone-900' : 'text-stone-700'}" title={note.id}>
					{note.title || note.id}
				</p>
				<p class="truncate text-xs text-stone-500">
					<span class="font-mono">{note.contract}</span>
					{#if rowState?.status === 'restored'}
						· <span class="text-green-700">Restored</span>
					{:else}
						· Deleted {formatDeletedDate(note.deletedAt)} · <span data-testid="trash-days-left">{purgeLabel(note.purgeAt)}</span>
					{/if}
				</p>
				{#if rowState?.status === 'failed'}
					<p class="text-xs text-red-600" role="alert">Could not restore it. Try again.</p>
				{/if}
			</div>
			{#if rowState?.status === 'restored'}
				<button
					type="button"
					onclick={() => openRestored(note)}
					class="flex-shrink-0 rounded-md btn-secondary px-3 py-1 text-sm"
					data-testid="trash-open"
				>
					Open
				</button>
			{:else}
				<button
					type="button"
					onclick={() => restore(note)}
					disabled={rowState?.status === 'restoring'}
					class="flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
					data-testid="trash-restore"
				>
					{rowState?.status === 'restoring' ? 'Restoring…' : 'Restore'}
				</button>
			{/if}
		</li>
	{/each}
</ul>
