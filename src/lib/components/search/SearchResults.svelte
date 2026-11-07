<!--
	Global search results: notes and time entries in one list, newest first (sprint 046-CL; the
	server still sends two groups, see search-interleave.ts), under a summary line of the counts.
	Each hit is a button; Up and Down walk the list in order (Up from the first goes back to the
	search field, via `onLeaveTop`).
-->
<script lang="ts">
	import SearchHitRow from './SearchHitRow.svelte';
	import { interleaveSearchHits, searchSummary } from './search-interleave';
	import type { GlobalSearchResponse, NoteHit, TimeEntryHit } from './search-types';

	interface Props {
		result: GlobalSearchResponse;
		/** Client id → colour index, for the dot on each hit */
		clientColorIndexes: Map<string, number>;
		onOpenNote: (hit: NoteHit) => void;
		onOpenEntry: (hit: TimeEntryHit) => void;
		onLeaveTop: () => void;
	}

	let { result, clientColorIndexes, onOpenNote, onOpenEntry, onLeaveTop }: Props = $props();

	const items = $derived(interleaveSearchHits(result));

	let listElement: HTMLElement | undefined = $state();

	function hitButtons(): HTMLElement[] {
		return Array.from(listElement?.querySelectorAll<HTMLElement>('[data-search-hit]') ?? []);
	}

	/** Focus the first hit (from the search field's ArrowDown) */
	export function focusFirstHit(): boolean {
		const first = hitButtons()[0];
		first?.focus();
		return !!first;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const buttons = hitButtons();
		const index = buttons.indexOf(document.activeElement as HTMLElement);
		if (index === -1) return;
		event.preventDefault();
		if (event.key === 'ArrowUp' && index === 0) return onLeaveTop();
		buttons[Math.min(Math.max(index + (event.key === 'ArrowDown' ? 1 : -1), 0), buttons.length - 1)].focus();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={listElement} onkeydown={handleKeydown} data-testid="search-results">
	<p class="mb-2 px-3 text-xs text-ink-faint" data-testid="search-summary">{searchSummary(result)}</p>
	{#if items.length === 0}
		<p class="px-3 py-2 text-sm text-ink-faint">Nothing matches.</p>
	{:else}
		<ul class="space-y-0.5" aria-label="Search results">
			{#each items as item (`${item.kind}:${item.hit.id}`)}
				<li>
					<SearchHitRow
						{item}
						clientColorIndex={clientColorIndexes.get(item.hit.clientId)}
						onOpen={() => (item.kind === 'note' ? onOpenNote(item.hit) : onOpenEntry(item.hit))}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>
