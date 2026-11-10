<!--
	All | None for the Total time contract selection (TT-09, sprint 066-TR): small pine text actions
	with a thin divider, in the desktop Contracts column header and the phone sheet's header. Same
	scope as before: All ticks every listed contract (inactive, archived and deleted included), None
	clears them all.
-->
<script lang="ts">
	let { onSelectAll, onSelectNone }: { onSelectAll: () => void; onSelectNone: () => void } = $props();

	const actionClass =
		'rounded-control px-2 py-1 text-sm text-primary hover:bg-primary-wash hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none pointer-coarse:min-h-11';
</script>

<div class="flex shrink-0 items-center" role="group" aria-label="Select contracts">
	<button type="button" onclick={onSelectAll} class={actionClass} data-testid="total-time-select-all">All</button>
	<span class="h-4 w-px bg-line" aria-hidden="true"></span>
	<button type="button" onclick={onSelectNone} class={actionClass} data-testid="total-time-select-none">None</button>
</div>
