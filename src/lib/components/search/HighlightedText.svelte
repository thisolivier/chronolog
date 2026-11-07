<!-- A snippet or title with its matches in <mark> (offsets come from the server; no {@html}) -->
<script lang="ts">
	import { snippetParts, type MatchRange } from '$lib/utils/search-snippet';

	let { text, matches }: { text: string; matches: MatchRange[] } = $props();

	const parts = $derived(snippetParts({ text, matches }));
</script>

{#each parts as part, index (index)}{#if part.isMatch}<mark class="rounded-sm bg-ochre-200 px-0.5 text-inherit">{part.text}</mark>{:else}{part.text}{/if}{/each}
