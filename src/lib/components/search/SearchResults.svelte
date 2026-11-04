<!--
	Global search results (sprint 042-CL), grouped Notes / Time entries. Each hit is a button; Up and
	Down move between hits (Up from the first goes back to the search field, via `onLeaveTop`).
-->
<script lang="ts">
	import HighlightedText from './HighlightedText.svelte';
	import { formatSmartDate } from '$lib/utils/format-date';
	import { formatDayHeader } from '$lib/utils/iso-week';
	import { formatMinutes } from '$lib/utils/duration';
	import type { GlobalSearchResponse, NoteHit, TimeEntryHit } from './search-types';

	interface Props {
		result: GlobalSearchResponse;
		onOpenNote: (hit: NoteHit) => void;
		onOpenEntry: (hit: TimeEntryHit) => void;
		onLeaveTop: () => void;
	}

	let { result, onOpenNote, onOpenEntry, onLeaveTop }: Props = $props();

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

	const hitClass =
		'block w-full rounded-md border border-transparent px-3 py-2.5 text-left hover:border-stone-200 hover:bg-white focus:border-blue-400 focus:bg-white focus:outline-none';
</script>

{#snippet groupHeading(label: string, shown: number, total: number)}
	<h2 class="mb-1 px-3 text-xs font-semibold tracking-wide text-stone-500 uppercase">
		{label}
		<span class="font-normal normal-case">· {shown < total ? `${shown} of ${total}` : total}</span>
	</h2>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={listElement} onkeydown={handleKeydown} class="space-y-6" data-testid="search-results">
	<section aria-label="Notes" data-testid="search-group-notes">
		{@render groupHeading('Notes', result.notes.hits.length, result.notes.total)}
		{#if result.notes.hits.length === 0}
			<p class="px-3 py-2 text-sm text-stone-400">No notes match.</p>
		{/if}
		{#each result.notes.hits as hit (hit.id)}
			<button type="button" class={hitClass} onclick={() => onOpenNote(hit)} data-search-hit="note" data-testid="search-hit-note">
				<div class="truncate text-[11px] font-medium tracking-wide text-stone-400 uppercase">
					{hit.clientShortCode} · {hit.contractName} · {formatSmartDate(hit.updatedAt)}
				</div>
				<div class="truncate text-sm font-semibold text-stone-900"><HighlightedText text={hit.title} matches={hit.titleMatches} /></div>
				{#if hit.snippet.text}
					<div class="line-clamp-2 text-xs text-stone-600"><HighlightedText text={hit.snippet.text} matches={hit.snippet.matches} /></div>
				{/if}
			</button>
		{/each}
	</section>

	<section aria-label="Time entries" data-testid="search-group-entries">
		{@render groupHeading('Time entries', result.timeEntries.hits.length, result.timeEntries.total)}
		{#if result.timeEntries.hits.length === 0}
			<p class="px-3 py-2 text-sm text-stone-400">No time entries match.</p>
		{/if}
		{#each result.timeEntries.hits as hit (hit.id)}
			<button type="button" class={hitClass} onclick={() => onOpenEntry(hit)} data-search-hit="entry" data-testid="search-hit-entry">
				<div class="truncate text-[11px] font-medium tracking-wide text-stone-400 uppercase">
					{hit.clientShortCode} · {hit.contractName} · {formatDayHeader(hit.date)} · {formatMinutes(hit.durationMinutes)}
				</div>
				<div class="line-clamp-2 text-sm text-stone-800"><HighlightedText text={hit.snippet.text} matches={hit.snippet.matches} /></div>
			</button>
		{/each}
	</section>
</div>
