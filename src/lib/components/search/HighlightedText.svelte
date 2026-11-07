<!--
	A snippet or title with its matches in <mark> (offsets come from the server; no {@html}).
	A wiki-link to a trashed note reads as its title, struck through and muted as in the time
	entry card (sprint 060-DR).
-->
<script lang="ts">
	import { snippetParts, type MatchRange } from '$lib/utils/search-snippet';

	let { text, matches, deletedLinks = [] }: { text: string; matches: MatchRange[]; deletedLinks?: MatchRange[] } = $props();

	const parts = $derived(snippetParts({ text, matches, deletedLinks }));
</script>

{#each parts as part, index (index)}{#if part.isDeletedLink}<span class="text-ink-faint line-through decoration-chalk-300" data-deleted-link>{#if part.isMatch}<mark class="rounded-sm bg-ochre-200 px-0.5 text-inherit">{part.text}</mark>{:else}{part.text}{/if}</span>{:else if part.isMatch}<mark class="rounded-sm bg-ochre-200 px-0.5 text-inherit">{part.text}</mark>{:else}{part.text}{/if}{/each}
