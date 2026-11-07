<!--
	One search hit, note or time entry (sprint 046-CL; design r1 SR-02, sprint 059-DR).
	Reading order: the type icon and the note title (an entry's description) first, then the
	contract mark with "Client / Contract", then the matching excerpt with the server's highlight
	ranges. A metadata-only hit names why it matched ("Matches client Amplitude") and shows no
	highlighted excerpt.
	- desktop/tablet (md, ≥ 768 px): a quiet date at the right, with an entry's duration under it;
	  the title keeps to one line.
	- phone: text wraps; the date (and duration) sit beneath the excerpt.
	The active row (keyboard focus) has the sage fill and pine edge used for selection elsewhere.
-->
<script lang="ts">
	import HighlightedText from './HighlightedText.svelte';
	import SearchTypeIcon from './SearchTypeIcon.svelte';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { formatSmartDate } from '$lib/utils/format-date';
	import { formatMinutes } from '$lib/utils/duration';
	import { formatEntryDateShort, type SearchListItem } from './search-interleave';
	import { matchReason } from './search-match-reason';

	interface Props {
		item: SearchListItem;
		onOpen: () => void;
	}

	let { item, onOpen }: Props = $props();

	const reason = $derived(matchReason(item.hit));
	const showNoteExcerpt = $derived(item.kind === 'note' && !reason && item.hit.snippet.text.length > 0);
	const dateLabel = $derived(item.kind === 'note' ? formatSmartDate(item.hit.updatedAt) : formatEntryDateShort(item.hit.date));
	const textColumn = 'col-start-2 min-w-0';
</script>

<button
	type="button"
	class="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-l-2 border-transparent px-3 py-3 text-left hover:bg-moss-50 focus:border-selection-edge focus:bg-moss-100 focus:outline-none md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-4"
	onclick={onOpen}
	data-search-hit={item.kind}
	data-hit-id={item.hit.id}
	data-testid={item.kind === 'note' ? 'search-hit-note' : 'search-hit-entry'}
>
	<SearchTypeIcon kind={item.kind} class="col-start-1 row-start-1 mt-0.5 h-6 w-6" />

	<div class="{textColumn} font-semibold text-ink {item.kind === 'note' ? 'md:truncate' : 'line-clamp-2'}">
		{#if item.kind === 'note'}
			<HighlightedText text={item.hit.title} matches={item.hit.titleMatches} />
		{:else}
			<HighlightedText text={item.hit.snippet.text} matches={item.hit.snippet.matches} deletedLinks={item.hit.snippet.deletedLinks} />
		{/if}
	</div>

	<div class="{textColumn} flex items-center gap-mark-gap text-sm text-ink-soft" data-testid="search-hit-context">
		<ContractMark contractName={item.hit.contractName} colorIndex={item.hit.clientColorIndex} size="sm" />
		<span class="min-w-0 truncate">{item.hit.clientName} / {item.hit.contractName}</span>
	</div>

	{#if reason}
		<div class="{textColumn} text-sm text-ink-muted italic" data-testid="search-hit-reason">{reason}</div>
	{:else if showNoteExcerpt && item.kind === 'note'}
		<div class="{textColumn} text-sm text-ink-muted md:line-clamp-2">
			<HighlightedText text={item.hit.snippet.text} matches={item.hit.snippet.matches} deletedLinks={item.hit.snippet.deletedLinks} />
		</div>
	{/if}

	<div
		class="{textColumn} flex items-baseline gap-1 text-xs whitespace-nowrap text-ink-faint tabular-nums md:col-start-3 md:row-span-2 md:row-start-1 md:flex-col md:items-end md:gap-0.5"
		data-testid="search-hit-date"
	>
		<span>{dateLabel}</span>
		{#if item.kind === 'entry'}
			<span class="md:hidden" aria-hidden="true">·</span>
			<span class="text-sm font-medium text-ink-soft">{formatMinutes(item.hit.durationMinutes)}</span>
		{/if}
	</div>
</button>
