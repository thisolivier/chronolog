<!--
	One search hit, note or time entry (sprint 046-CL). A two-column grid:
	- desktop/tablet (md, ≥ 768 px): the type icon fills a fixed left column; to its right the
	  client/contract line (date, and duration, at its end), then the title or description, then
	  the snippet.
	- phone: the icon stays in the first cell of the client/contract line, which names the client by
	  its short code so the contract fits; the title and snippet below span both columns, so the meta
	  takes one line and nothing scrolls sideways at 320 px.
-->
<script lang="ts">
	import HighlightedText from './HighlightedText.svelte';
	import SearchTypeIcon from './SearchTypeIcon.svelte';
	import { formatSmartDate } from '$lib/utils/format-date';
	import { formatDayHeader } from '$lib/utils/iso-week';
	import { formatMinutes } from '$lib/utils/duration';
	import { getClientDotClass } from '$lib/utils/client-colors';
	import { formatEntryDateShort, type SearchListItem } from './search-interleave';

	interface Props {
		item: SearchListItem;
		/** Undefined while the client list loads (grey dot) */
		clientColorIndex: number | undefined;
		onOpen: () => void;
	}

	let { item, clientColorIndex, onOpen }: Props = $props();

	const hasNoteSnippet = $derived(item.kind === 'note' && item.hit.snippet.text.length > 0);
	const dotClass = $derived(clientColorIndex === undefined ? 'bg-stone-300' : getClientDotClass(clientColorIndex));
	const belowClass = 'col-span-2 min-w-0 md:col-span-1 md:col-start-2';
</script>

<button
	type="button"
	class="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 rounded-md border border-transparent px-3 py-2.5 text-left hover:border-stone-200 hover:bg-white focus:border-blue-400 focus:bg-white focus:outline-none md:items-start md:gap-x-3"
	onclick={onOpen}
	data-search-hit={item.kind}
	data-testid={item.kind === 'note' ? 'search-hit-note' : 'search-hit-entry'}
>
	<SearchTypeIcon
		kind={item.kind}
		class="col-start-1 row-start-1 h-5 w-5 md:mt-0.5 md:h-8 md:w-8 {hasNoteSnippet ? 'md:row-span-3' : 'md:row-span-2'}"
	/>

	<div class="col-start-2 row-start-1 flex min-w-0 items-center gap-2 text-sm text-stone-700" data-testid="search-hit-context">
		<span class="h-2 w-2 flex-shrink-0 rounded-full {dotClass}" aria-hidden="true"></span>
		<span class="min-w-0 flex-1 truncate font-medium"
			><span class="md:hidden" title={item.hit.clientName}>{item.hit.clientShortCode}</span><span class="hidden md:inline">{item.hit.clientName}</span>
			/ {item.hit.contractName}</span
		>
		<span class="flex-shrink-0 text-xs whitespace-nowrap text-stone-500 tabular-nums" data-testid="search-hit-date">
			{#if item.kind === 'note'}
				{formatSmartDate(item.hit.updatedAt)}
			{:else}
				<span class="hidden md:inline">{formatDayHeader(item.hit.date)}</span><span class="md:hidden">{formatEntryDateShort(item.hit.date)}</span>
				· {formatMinutes(item.hit.durationMinutes)}
			{/if}
		</span>
	</div>

	{#if item.kind === 'note'}
		<div class="{belowClass} truncate text-sm font-semibold text-stone-900">
			<HighlightedText text={item.hit.title} matches={item.hit.titleMatches} />
		</div>
		{#if hasNoteSnippet}
			<div class="{belowClass} line-clamp-1 text-xs text-stone-600 md:line-clamp-2">
				<HighlightedText text={item.hit.snippet.text} matches={item.hit.snippet.matches} />
			</div>
		{/if}
	{:else}
		<div class="{belowClass} line-clamp-2 text-sm text-stone-900">
			<HighlightedText text={item.hit.snippet.text} matches={item.hit.snippet.matches} />
		</div>
	{/if}
</button>
