<!-- "Linked from": notes whose content links to this one, shown by title (ID as tooltip) -->
<script lang="ts">
	import type { Backlink } from '$lib/services/types';

	interface Props {
		backlinks: Backlink[];
		onOpen: (backlink: Backlink) => void;
	}

	let { backlinks, onOpen }: Props = $props();
</script>

{#if backlinks.length > 0}
	<div class="border-t border-stone-200 bg-white px-6 py-3" data-testid="note-backlinks">
		<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Linked from</h4>
		<div class="flex flex-wrap gap-2">
			{#each backlinks as backlink (backlink.sourceNoteId)}
				<button
					type="button"
					onclick={() => onOpen(backlink)}
					title={backlink.sourceNoteId}
					class="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
				>
					{backlink.noteTitle || backlink.sourceNoteId}
				</button>
			{/each}
		</div>
	</div>
{/if}
