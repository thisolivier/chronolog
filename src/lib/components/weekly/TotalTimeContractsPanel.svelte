<!--
	The desktop Contracts column of the Total time modal (TT-03, sprint 066-TR): "Contracts" with
	"N selected" (ticked IDs, contracts with no time included) under it, All | None at the top right,
	then the shared client-grouped list, which scrolls inside the column so the modal never grows
	with it. Changes are live: no Apply.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import TotalTimeBulkActions from './TotalTimeBulkActions.svelte';
	import { selectedCountLabel } from './total-time';

	let {
		selectedCount,
		onSelectAll,
		onSelectNone,
		children
	}: {
		selectedCount: number;
		onSelectAll: () => void;
		onSelectNone: () => void;
		/** The contract list (TotalTimeContractList) */
		children: Snippet;
	} = $props();
</script>

<section class="flex min-h-0 flex-col" aria-labelledby="total-time-contracts-heading" data-testid="total-time-contracts-panel">
	<div class="flex shrink-0 items-start gap-2 pb-3">
		<div class="min-w-0 flex-1">
			<h3 id="total-time-contracts-heading" class="text-lg leading-tight font-semibold text-primary">Contracts</h3>
			<p class="text-sm text-ink-muted" data-testid="total-time-selected-count">{selectedCountLabel(selectedCount)}</p>
		</div>
		<TotalTimeBulkActions {onSelectAll} {onSelectNone} />
	</div>
	<div class="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 pb-1" data-testid="total-time-contracts-scroller">
		{@render children()}
	</div>
</section>
