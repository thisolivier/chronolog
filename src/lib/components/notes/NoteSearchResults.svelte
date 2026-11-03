<!-- Results of the notes search: notes from every contract, each with its contract prefix -->
<script lang="ts">
	import { formatSmartDate } from '$lib/utils/format-date';
	import type { NoteSearchResult } from '$lib/services/types';

	interface Props {
		results: NoteSearchResult[];
		isSearching: boolean;
		selectedNoteId: string | null;
		onOpen: (result: NoteSearchResult) => void;
	}

	let { results, isSearching, selectedNoteId, onOpen }: Props = $props();
</script>

<div data-testid="note-search-results">
	{#if results.length === 0}
		<div class="px-4 py-6 text-center text-sm text-stone-500">
			{isSearching ? 'Searching…' : 'No matching notes'}
		</div>
	{:else}
		<div class="divide-y divide-stone-200">
			{#each results as result (result.id)}
				<button
					type="button"
					onclick={() => onOpen(result)}
					title={result.id}
					class="block w-full border-l-2 px-4 py-2.5 text-left transition-colors hover:bg-stone-100
						{selectedNoteId === result.id ? 'border-blue-600 bg-blue-50' : 'border-transparent'}"
				>
					<div class="truncate text-[11px] font-medium uppercase tracking-wide text-stone-400">
						{result.clientShortCode} · {result.contractName}
					</div>
					<div class="truncate text-sm font-semibold text-stone-900">
						{result.displayTitle || result.id}
					</div>
					<div class="truncate text-xs text-stone-500">
						<span class="font-medium">{formatSmartDate(result.updatedAt)}</span>
						{#if result.secondLine}
							<span class="ml-1.5 text-stone-400">{result.secondLine}</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
