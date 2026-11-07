<!--
	The global search field (sprint 042-CL): in the shell's top bar and on /search. Enter opens
	`/search?q=…` (the URL is the state; typing adds no history step, submitting adds one); Cmd+K / Ctrl+K focuses it from anywhere; ArrowDown moves
	into the results on /search (`onArrowDown`).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isSearchShortcut, shortcutLabel } from '$lib/components/find/shortcuts';

	interface Props {
		initialQuery?: string;
		autofocus?: boolean;
		onArrowDown?: () => void;
		class?: string;
	}

	let { initialQuery = '', autofocus = false, onArrowDown, class: className = '' }: Props = $props();

	let input: HTMLInputElement | undefined = $state();
	// Follows the URL (Back/Forward between searches); typing overrides it until the next one
	let query = $derived(initialQuery);
	let shortcutHint = $state('');

	$effect(() => {
		shortcutHint = shortcutLabel('k');
		if (autofocus) input?.focus();
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = query.trim();
		if (!trimmed) return;
		// Typing is not a step; submitting is one (050-UI), unless it is the search already shown
		if (page.url.pathname === '/search' && page.url.searchParams.get('q') === trimmed) return;
		void goto(`/search?q=${encodeURIComponent(trimmed)}`, { keepFocus: true });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			input?.blur();
		} else if (event.key === 'ArrowDown' && onArrowDown) {
			event.preventDefault();
			onArrowDown();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!isSearchShortcut(event) || !input || input.getClientRects().length === 0) return;
		event.preventDefault();
		input.focus();
		input.select();
	}
</script>

<svelte:window onkeydowncapture={handleWindowKeydown} />

<form role="search" onsubmit={submit} class="relative {className}">
	<input
		bind:this={input}
		bind:value={query}
		onkeydown={handleKeydown}
		type="search"
		enterkeyhint="search"
		placeholder="Search notes and time"
		aria-label="Search notes and time entries"
		class="w-full rounded-md border border-line bg-chalk-50 py-1 pr-12 pl-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-focus focus:bg-surface focus:outline-none"
		data-testid="global-search-input"
	/>
	{#if shortcutHint && !query}
		<kbd class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-divider bg-surface px-1 text-[10px] text-ink-faint">{shortcutHint}</kbd>
	{/if}
</form>
