<!--
	/search?q=… (sprint 042-CL): global search results. The URL is the state: Back/Forward and
	reload show the same search. A note hit opens the note in the workspace (openNote); an entry hit
	opens its week with the entry focused. Sprint 046-CL: one interleaved list; client colours come
	from `GET /api/clients`, fetched once beside the search.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import ConnectionStatus from '$lib/components/layout/ConnectionStatus.svelte';
	import GlobalSearchField from '$lib/components/search/GlobalSearchField.svelte';
	import HistoryButtons from '$lib/components/layout/HistoryButtons.svelte';
	import SearchResults from '$lib/components/search/SearchResults.svelte';
	import { revealTimeEntry } from '$lib/components/search/entry-reveal';
	import { fetchClientColorIndexes, fetchGlobalSearch, type GlobalSearchResponse, type NoteHit, type TimeEntryHit } from '$lib/components/search/search-types';

	const navigation = getNavigationContext();
	const MINIMUM_QUERY_LENGTH = 2;

	const query = $derived((page.url.searchParams.get('q') ?? '').trim());
	let result = $state<GlobalSearchResponse | null>(null);
	let isSearching = $state(false);
	let errorMessage = $state<string | null>(null);
	let resultsComponent: SearchResults | undefined = $state();
	let clientColorIndexes = $state(new Map<string, number>());

	$effect(() => {
		const controller = new AbortController();
		fetchClientColorIndexes(controller.signal).then((indexes) => (clientColorIndexes = indexes));
		return () => controller.abort();
	});

	$effect(() => {
		const currentQuery = query;
		result = null;
		errorMessage = null;
		if (currentQuery.length < MINIMUM_QUERY_LENGTH) return;
		const controller = new AbortController();
		isSearching = true;
		fetchGlobalSearch(currentQuery, controller.signal)
			.then((response) => (result = response))
			.catch((error: Error) => {
				if (error.name !== 'AbortError') errorMessage = 'Search failed. Check your connection and try again.';
			})
			.finally(() => {
				if (!controller.signal.aborted) isSearching = false;
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

<svelte:head><title>{query ? `Chronolog · Search · ${query}` : 'Chronolog · Search'}</title></svelte:head>

<div class="safe-area-shell min-h-dvh bg-chalk-50">
	<header class="border-b border-divider bg-surface shadow-sm">
		<div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
			<a href={navigation.workspaceHref} class="hidden text-lg font-bold text-ink sm:block">Chronolog</a>
			<div class="hidden md:block"><HistoryButtons /></div>
			<GlobalSearchField
				initialQuery={query}
				autofocus={!query}
				onArrowDown={() => resultsComponent?.focusFirstHit()}
				class="min-w-0 flex-1"
			/>
			<a
				href={navigation.workspaceHref}
				class="flex-shrink-0 rounded-md btn-secondary px-3 py-1.5 text-sm"
				data-testid="search-back-to-app"
			>
				Back<span class="hidden sm:inline">&nbsp;to app</span>
			</a>
		</div>
	</header>
	<ConnectionStatus />

	<main class="mx-auto max-w-3xl px-2 py-4 sm:px-4 sm:py-6">
		{#if query.length < MINIMUM_QUERY_LENGTH}
			<p class="px-3 text-sm text-ink-faint">
				{query ? 'Type at least two characters.' : 'Search the titles and text of every note, and every time entry description.'}
			</p>
		{:else if errorMessage}
			<p class="px-3 text-sm text-rust-600" role="alert">{errorMessage}</p>
		{:else if result}
			<SearchResults
				bind:this={resultsComponent}
				{result}
				{clientColorIndexes}
				onOpenNote={openNote} onOpenEntry={openEntry} onLeaveTop={focusSearchField} />
		{:else if isSearching}
			<p class="px-3 text-sm text-ink-faint">Searching…</p>
		{/if}
	</main>
</div>
