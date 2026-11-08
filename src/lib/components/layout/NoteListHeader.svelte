<!--
	NoteListHeader — the note list's header (split from NoteListPanel in sprint 064-DR).
	Who names the client / contract follows `note-context-ownership.ts` (`data-owner`):
	- `notes` (one contract, the sidebar beside the list, which already names it): one row since
	  064-DR (N2) — the sort toggle at the left, the contract's quiet repeat filling the middle, the
	  New note icon at the right. The "Notes" title, the contract and the count stay as screen-reader
	  text (`note-list-context` is `sr-only`).
	- `contract`, `client`, `all`: a title row (eyebrow, title and count, the repeat for a contract,
	  New note) with the sort toggle on its own row below (054-DR, NT-01 / NT-02).
	The repeat (NT-03 / DS-04, 063-DR) is drawn only for one contract's list, never for a client's or
	all notes, and shrinks to nothing before anything else in its row.
-->
<script lang="ts">
	import NoteListNewNoteButton from './NoteListNewNoteButton.svelte';
	import ContractTileRepeat from '$lib/components/identity/ContractTileRepeat.svelte';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { ALL_NOTES_LABEL } from './navigation-labels';
	import type { NoteContextOwnership } from './note-context-ownership';
	import type { NoteSortOrder } from '$lib/components/notes/note-sort';
	import type { ContractsByClientResult } from '$lib/services/types';
	import type { ContractLabel } from '$lib/stores/contract-directory.svelte';

	interface Props {
		listHeader: NoteContextOwnership['listHeader'];
		/** The selected contract (a contract's list) */
		selectedContractId: string | null;
		contractLabel: ContractLabel | undefined;
		/** The client view's client; null otherwise */
		viewedClientId: string | null;
		viewedClientName: string | null | undefined;
		/** The contract whose tile repeats in the header (one contract's list only) */
		repeatContractId: string | null;
		/** The note count; null while loading or after a load error */
		noteCount: number | null;
		sortOrder: NoteSortOrder;
		onToggleSort: () => void;
		/** New note: the list's contract (null in the client view and all notes) */
		newNoteContractId: string | null;
		newNoteContracts: ContractsByClientResult[];
		newNoteWithClientNames: boolean;
		onCreate: (contractId: string) => void;
	}

	let {
		listHeader,
		selectedContractId,
		contractLabel,
		viewedClientId,
		viewedClientName,
		repeatContractId,
		noteCount,
		sortOrder,
		onToggleSort,
		newNoteContractId,
		newNoteContracts,
		newNoteWithClientNames,
		onCreate
	}: Props = $props();

	const isOneRow = $derived(listHeader === 'notes');
	const contextTitle = $derived(
		listHeader === 'all'
			? 'All notes, newest first'
			: listHeader === 'client'
				? `${viewedClientName ?? 'Client'} · all contracts`
				: contractLabel
					? `${contractLabel.clientName} · ${contractLabel.name}`
					: undefined
	);
</script>

{#snippet context()}
	<div
		class={isOneRow ? 'sr-only' : 'min-w-0'}
		data-testid="note-list-context"
		data-owner={listHeader}
		data-contract-id={listHeader === 'notes' || listHeader === 'contract' ? selectedContractId : undefined}
		data-client-id={viewedClientId ?? undefined}
		title={contextTitle}
	>
		{#if listHeader === 'all'}
			<p class="truncate text-xs text-ink-faint">Every contract, newest first</p>
		{:else if listHeader === 'client'}
			<p class="truncate text-xs text-ink-faint">All contracts</p>
		{:else if listHeader === 'contract' && contractLabel}
			<p class="truncate text-xs text-ink-faint" data-testid="note-list-eyebrow">{contractLabel.clientName}</p>
		{/if}
		<h2 class="flex min-w-0 items-baseline gap-2 text-base font-semibold text-ink">
			{#if listHeader === 'contract' && contractLabel}
				<span class="flex min-w-0 items-center gap-mark-gap self-center">
					<ContractMark contractName={contractLabel.name} contractId={selectedContractId} colorIndex={contractLabel.clientColorIndex} size="sm" />
					<span class="truncate" data-testid="note-list-title">{contractLabel.name}</span>
				</span>
			{:else}
				<span class="truncate" data-testid="note-list-title">
					{listHeader === 'all' ? ALL_NOTES_LABEL : listHeader === 'client' ? (viewedClientName ?? 'Notes') : 'Notes'}
				</span>
				{#if listHeader === 'notes' && contractLabel}
					<!-- The sidebar shows the contract; screen readers still hear whose notes these are -->
					<span class="sr-only" data-testid="note-list-context-sr">: {contractLabel.clientName} / {contractLabel.name}</span>
				{/if}
			{/if}
			{#if noteCount !== null}
				<span
					class="shrink-0 text-sm font-normal tabular-nums text-ink-faint"
					data-testid="note-list-count"
					aria-label="{noteCount} {noteCount === 1 ? 'note' : 'notes'}">{noteCount}</span
				>
			{/if}
		</h2>
	</div>
{/snippet}

{#snippet repeat()}
	<div class="flex min-w-0 flex-1 items-center" aria-hidden="true" data-testid="note-list-header-space">
		{#if repeatContractId && contractLabel}
			<ContractTileRepeat contractId={repeatContractId} colorIndex={contractLabel.clientColorIndex} />
		{/if}
	</div>
{/snippet}

{#snippet newNote()}
	<NoteListNewNoteButton contractId={newNoteContractId} clientContracts={newNoteContracts} withClientNames={newNoteWithClientNames} {onCreate} />
{/snippet}

{#snippet sortToggle()}
	<button
		type="button"
		onclick={onToggleSort}
		class="-ml-2 shrink-0 rounded px-2 py-1 text-xs whitespace-nowrap btn-quiet pointer-coarse:min-h-11"
		title="Change sort order"
		data-testid="note-sort-toggle"
	>
		{sortOrder === 'modified' ? 'Modified ↓' : 'Created ↓'}
	</button>
{/snippet}

<div
	class="border-b border-divider bg-surface px-4 {isOneRow ? 'py-1.5' : 'pt-3 pb-1.5'}"
	data-testid="note-list-header"
	data-layout={isOneRow ? 'one-row' : 'title-rows'}
>
	{#if isOneRow}
		<!-- 064-DR (N2): sort, the contract repeat, New note; the title only for screen readers -->
		<div class="flex items-center gap-2">
			{@render context()}
			{@render sortToggle()}
			{@render repeat()}
			{@render newNote()}
		</div>
	{:else}
		<div class="flex items-center gap-2">
			{@render context()}
			{@render repeat()}
			{@render newNote()}
		</div>
		<div class="mt-1 flex items-center">{@render sortToggle()}</div>
	{/if}
</div>
