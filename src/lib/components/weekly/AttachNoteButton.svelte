<!--
	AttachNoteButton — the time entry card's "Attach note" icon (sprint 049-UI). The card does the
	work (`onAttach`); this button shows it, refuses a second press while one is running (one note
	per click) and, when the entry cannot have a note, stays focusable with the reason as its tooltip.
-->
<script lang="ts">
	let {
		blockedReason = null,
		onAttach
	}: {
		/** Why a note cannot be attached (no contract); null when it can */
		blockedReason?: string | null;
		onAttach: () => Promise<void>;
	} = $props();

	let isAttaching = $state(false);

	const isUnavailable = $derived(Boolean(blockedReason) || isAttaching);
	const tooltip = $derived(blockedReason ?? (isAttaching ? 'Attaching a new note…' : 'Attach a new note'));

	async function handleClick(event: MouseEvent) {
		// The card's own click handlers (editors) must not see this press
		event.stopPropagation();
		if (isUnavailable) return;
		isAttaching = true;
		try {
			await onAttach();
		} finally {
			isAttaching = false;
		}
	}
</script>

<button
	type="button"
	onclick={handleClick}
	aria-disabled={isUnavailable}
	aria-busy={isAttaching}
	aria-label="Attach note"
	title={tooltip}
	data-testid="attach-note-button"
	class="flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-opacity
		hover:bg-blue-50 hover:text-blue-600 focus-visible:opacity-100
		aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent aria-disabled:hover:text-stone-400
		pointer-coarse:h-8 pointer-coarse:w-8 pointer-coarse:opacity-100
		{isAttaching ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}
		{blockedReason ? 'text-stone-300' : ''}"
>
	<!-- A page with a plus: a new note -->
	<svg class="h-4 w-4 {isAttaching ? 'animate-pulse' : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
		<path d="M9.5 1.75H4.25a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h4.5" stroke-linecap="round" stroke-linejoin="round" />
		<path d="M9.5 1.75 12.75 5v3.25M9.5 1.75V5h3.25" stroke-linecap="round" stroke-linejoin="round" />
		<path d="M12 10.25v4M10 12.25h4" stroke-linecap="round" />
	</svg>
</button>
