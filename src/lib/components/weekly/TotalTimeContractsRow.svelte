<!--
	The phone's "Contracts · N selected" row (Total time r1, TT-04, sprint 066-TR): one full-width
	button between the dates and the total, filter icon left, chevron right, on the pine wash. It
	opens TotalTimeContractSheet; focus comes back to it when the sheet closes.
-->
<script lang="ts">
	import { selectedCountLabel } from './total-time';

	let {
		selectedCount,
		isExpanded,
		onOpen,
		element = $bindable()
	}: {
		selectedCount: number;
		isExpanded: boolean;
		onOpen: () => void;
		element?: HTMLButtonElement;
	} = $props();
</script>

<button
	bind:this={element}
	type="button"
	onclick={onOpen}
	aria-haspopup="dialog"
	aria-expanded={isExpanded}
	class="mb-5 flex min-h-12 w-full items-center gap-3 rounded-panel bg-primary-wash px-3 text-left text-ink hover:bg-pine-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
	data-testid="total-time-contracts-row"
>
	<svg class="size-5 shrink-0 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true">
		<path d="M3.5 5h17l-6.5 7.5V19l-4 1.5v-8z" />
	</svg>
	<span class="flex-1 font-semibold">Contracts</span>
	<span class="text-sm text-ink-muted">{selectedCountLabel(selectedCount)}</span>
	<svg class="size-4 shrink-0 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="m9 6 6 6-6 6" />
	</svg>
</button>
