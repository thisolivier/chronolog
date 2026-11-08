<!--
	NoteListRow — one note in the note list (split out of NoteListPanel, sprint 039-CL).
	The row opens the note; the pin button on its right pins or unpins it. When pinned the pin
	stays visible and is the row's marker; unpinned it shows on hover or focus (always faintly on
	touch screens). In a list spanning contracts (client view, all notes) the row names its contract
	on its own line with the contract mark (054-DR, NT-01): the contract's name in the client view,
	"Client · Contract" in all notes. A single-contract list passes no `contractName`.
	Selected: a quiet sage fill with a narrow pine left edge (NT-02).
-->
<script lang="ts">
	import { formatSmartDate } from '$lib/utils/format-date';
	import type { NoteSummary } from '$lib/services/types';
	import OutboxMarker from '$lib/offline/OutboxMarker.svelte';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';

	let {
		note,
		isSelected,
		dateField,
		contractName = null,
		onOpen,
		onTogglePin
	}: {
		note: NoteSummary;
		isSelected: boolean;
		dateField: 'createdAt' | 'updatedAt';
		/** The row's contract text, in lists spanning contracts only */
		contractName?: string | null;
		onOpen: (note: NoteSummary) => void;
		onTogglePin: (note: NoteSummary) => void;
	} = $props();

	const title = $derived(note.firstLine || 'Untitled');
	const contractLabel = $derived(contractName ? contractDirectory.labels[note.contractId] : undefined);
</script>

<div class="group relative" data-testid="note-list-row" data-note-id={note.id} data-pinned={note.isPinned ? 'true' : undefined}>
	<button
		onclick={() => onOpen(note)}
		class="block w-full text-left transition-colors hover:bg-chalk-100
			{isSelected ? 'border-l-2 border-selection-edge bg-moss-100' : 'border-l-2 border-transparent'}"
	>
		<div class="py-3 pr-9 pl-4">
			<span class="mb-0.5 flex items-center gap-1.5">
				<span class="truncate text-sm font-semibold text-ink">{title}</span>
				<OutboxMarker resourceKey="note:{note.id}" otherKey={note.clientRequestId ? `note:${note.clientRequestId}` : null} />
			</span>
			{#if contractName}
				<div class="flex min-w-0 items-center gap-mark-gap py-px">
					{#if contractLabel}
						<ContractMark
							contractName={contractLabel.name}
							contractId={note.contractId}
							colorIndex={contractLabel.clientColorIndex}
							size="sm"
						/>
					{/if}
					<span class="truncate text-xs font-medium text-ink-muted" data-testid="note-row-contract">{contractName}</span>
				</div>
			{/if}
			<div class="truncate text-xs text-ink-faint">
				<span class="font-medium">{formatSmartDate(note[dateField])}</span>
				{#if note.secondLine}
					<span class="ml-1.5 text-ink-faint">{note.secondLine}</span>
				{/if}
			</div>
		</div>
	</button>
	<button
		type="button"
		onclick={() => onTogglePin(note)}
		class="absolute top-2.5 right-2 rounded p-1 transition-opacity pointer-coarse:top-0 pointer-coarse:right-0 pointer-coarse:p-[15px] hover:bg-chalk-200 focus-visible:opacity-100
			{note.isPinned
			? 'text-ochre-600 opacity-100'
			: 'text-ink-faint opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-50'}"
		aria-pressed={note.isPinned}
		aria-label="{note.isPinned ? 'Unpin' : 'Pin'} “{title}”"
		title={note.isPinned ? 'Pinned: click to unpin' : 'Pin to the top'}
		data-testid="note-pin-toggle"
	>
		<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill={note.isPinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.4" aria-hidden="true">
			<path d="M6 1.75h4l-.5 4 2.5 2.5v1.25H4V8.25l2.5-2.5-.5-4Z" stroke-linejoin="round" />
			<path d="M8 9.5v4.75" stroke-linecap="round" />
		</svg>
	</button>
</div>
