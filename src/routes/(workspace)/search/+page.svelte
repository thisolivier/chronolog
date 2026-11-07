<!--
	/search?q=… (sprint 042-CL): global search results. The URL is the state: Back/Forward and
	reload show the same search. A note hit opens the note in the workspace (openNote); an entry hit
	opens its week with the entry focused.
	Since 059-DR (SR-01, SH-05) the page renders inside the app shell (the workspace layout passes it
	to AppShell in place of the list and content panels), so the sidebar, Back/Forward and the timer
	stay available; the shell hides its header search here and this page shows one large query field
	above the results in every state (prompt, loading, no matches, failure, results).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import GlobalSearchField from '$lib/components/search/GlobalSearchField.svelte';
	import SearchResults from '$lib/components/search/SearchResults.svelte';
	import { revealTimeEntry } from '$lib/components/search/entry-reveal';
	import { fetchGlobalSearch, type GlobalSearchResponse, type NoteHit, type TimeEntryHit } from '$lib/components/search/search-types';

	const navigation = getNavigationContext();
	const MINIMUM_QUERY_LENGTH = 2;

	const query = $derived((page.url.searchParams.get('q') ?? '').trim());
	let result = $state<GlobalSearchResponse | null>(null);
	let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let resultsComponent: SearchResults | undefined = $state();
	let retryToken = $state(0);
	// Each search gets a number; a reply that is not for the latest one is ignored (as well as aborted)
	let latestSearch = 0;

	// Focus the field on arrival, with the caret after the query: from the phone's search icon (no
	// query) and from the desktop header field (the hand-off). Not on a phone with results, where
	// the keyboard would cover them.
	const takesFocus = untrack(() => !query || navigation.layoutMode !== 'mobile');

	$effect(() => {
		const currentQuery = query;
		void retryToken;
		const searchNumber = ++latestSearch;
		result = null;
		if (currentQuery.length < MINIMUM_QUERY_LENGTH) {
			status = 'idle';
			return;
		}
		status = 'loading';
		const controller = new AbortController();
		fetchGlobalSearch(currentQuery, controller.signal)
			.then((response) => {
				if (searchNumber !== latestSearch) return;
				result = response;
				status = 'ready';
			})
			.catch(() => {
				if (searchNumber !== latestSearch || controller.signal.aborted) return;
				status = 'error';
			});
		return () => controller.abort();
	});

	function openNote(hit: NoteHit) {
		navigation.openNote(hit.id, hit.contractId, hit.clientId);
	}

	function openEntry(hit: TimeEntryHit) {
		navigation.showTimeEntryDay(hit.date);
		void revealTimeEntry(hit.id);
	}

	function focusSearchField() {
		document.querySelector<HTMLInputElement>('[data-testid="global-search-input"]')?.focus();
	}
</script>

<div class="mx-auto w-full max-w-3xl px-3 pt-4 pb-8 sm:px-6 sm:pt-6" data-testid="search-page">
	<GlobalSearchField
		size="large"
		initialQuery={query}
		autofocus={takesFocus}
		onArrowDown={() => resultsComponent?.focusFirstHit()}
		class="w-full"
	/>

	<div class="mt-4" aria-live="polite" aria-busy={status === 'loading'}>
		{#if status === 'idle'}
			<p class="px-3 text-sm text-ink-muted" data-testid="search-status" data-state="prompt">
				{query ? 'Type at least two characters.' : 'Search the titles and text of every note, every time entry description, and their clients and contracts.'}
			</p>
		{:else if status === 'loading'}
			<p class="flex items-center gap-2 px-3 text-sm text-ink-muted" data-testid="search-status" data-state="loading">
				<span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-chalk-300 border-t-pine-600" aria-hidden="true"></span>
				Searching…
			</p>
		{:else if status === 'error'}
			<div class="flex flex-wrap items-center gap-3 px-3 text-sm" role="alert" data-testid="search-status" data-state="error">
				<span class="text-rust-600">Search failed. Check your connection and try again.</span>
				<button type="button" class="rounded-md btn-secondary px-3 py-1 text-sm" onclick={() => retryToken++}>Try again</button>
			</div>
		{:else if result}
			<SearchResults bind:this={resultsComponent} {result} onOpenNote={openNote} onOpenEntry={openEntry} onLeaveTop={focusSearchField} />
		{/if}
	</div>
</div>
