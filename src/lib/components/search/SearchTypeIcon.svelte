<!-- The type of a search hit (sprint 046-CL): a note (page) or a time entry (clock), inline SVG -->
<script lang="ts">
	let { kind, class: className = '' }: { kind: 'note' | 'entry'; class?: string } = $props();

	const label = $derived(kind === 'note' ? 'Note' : 'Time entry');
</script>

<span
	role="img"
	aria-label={label}
	title={label}
	class="inline-flex flex-shrink-0 items-center justify-center rounded-md {kind === 'note'
		? 'bg-sky-50 text-sky-700'
		: 'bg-emerald-50 text-emerald-700'} {className}"
	data-testid="search-hit-type-icon"
	data-kind={kind}
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-[62%] w-[62%]" aria-hidden="true">
		{#if kind === 'note'}
			<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
			<path d="M14 3v5h5" />
			<path d="M9 13h6M9 17h4" />
		{:else}
			<circle cx="12" cy="12" r="8.5" />
			<path d="M12 7.5V12l3 2" />
		{/if}
	</svg>
</span>
