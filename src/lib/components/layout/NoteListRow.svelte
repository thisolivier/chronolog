<!--
	NoteListRow — one note in the note list (split out of NoteListPanel, sprint 039-CL).
	The row opens the note; the pin button on its right pins or unpins it. When pinned the pin
	stays visible and is the row's marker; unpinned it shows on hover or focus (always faintly on
	touch screens). `contractName` is shown in the client view, where rows come from several contracts.
-->
<script lang="ts">
	import { formatSmartDate } from '$lib/utils/format-date';
	import type { NoteSummary } from '$lib/services/types';
	import OutboxMarker from '$lib/offline/OutboxMarker.svelte';

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
		contractName?: string | null;
		onOpen: (note: NoteSummary) => void;
		onTogglePin: (note: NoteSummary) => void;
	} = $props();

	const title = $derived(note.firstLine || 'Untitled');
</script>

<div class="group relative" data-testid="note-list-row" data-note-id={note.id} data-pinned={note.isPinned ? 'true' : undefined}>
	<button
		onclick={() => onOpen(note)}
		class="block w-full text-left transition-colors hover:bg-stone-100
			{isSelected ? 'border-l-2 border-blue-600 bg-blue-50' : 'border-l-2 border-transparent'}"
	>
		<div class="py-3 pr-9 pl-4">
			<span class="mb-0.5 flex items-center gap-1.5">
				<span class="truncate text-sm font-semibold text-stone-900">{title}</span>
				<OutboxMarker resourceKey="note:{note.id}" otherKey={note.clientRequestId ? `note:${note.clientRequestId}` : null} />
			</span>
			<div class="truncate text-xs text-stone-500">
				{#if contractName}
					<span class="mr-1.5 font-medium text-stone-600" data-testid="note-row-contract">{contractName}</span>
				{/if}
				<span class="font-medium">{formatSmartDate(note[dateField])}</span>
				{#if note.secondLine}
					<span class="ml-1.5 text-stone-400">{note.secondLine}</span>
				{/if}
			</div>
		</div>
	</button>
	<button
		type="button"
		onclick={() => onTogglePin(note)}
		class="absolute top-2.5 right-2 rounded p-1 transition-opacity hover:bg-stone-200 focus-visible:opacity-100
			{note.isPinned
			? 'text-amber-500 opacity-100'
			: 'text-stone-400 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-50'}"
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
