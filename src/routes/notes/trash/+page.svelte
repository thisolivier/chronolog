<!--
	/notes/trash (sprint 043-CL): the user's trashed notes, newest deletion first, with the days left
	before the 30-day purge and a Restore button per row. A standalone page like Settings and Search
	(the URL is the state; Back to app returns to the last workspace URL). Reached from "Trash" at the
	bottom of the sidebar.
-->
<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import ConnectionStatus from '$lib/components/layout/ConnectionStatus.svelte';
	import TrashList from '$lib/components/notes/TrashList.svelte';
	import { fetchTrashedNotes, type TrashedNote } from '$lib/components/notes/trash-view';

	const navigation = getNavigationContext();

	let notes = $state<TrashedNote[] | null>(null);
	let errorMessage = $state<string | null>(null);

	async function load() {
		errorMessage = null;
		try {
			notes = await fetchTrashedNotes();
		} catch (loadError) {
			console.error('Could not load the trash:', loadError);
			errorMessage = 'Could not load the trash. Check your connection and try again.';
		}
	}

	$effect(() => {
		void load();
	});
</script>

<svelte:head><title>Chronolog · Trash</title></svelte:head>

<div class="min-h-screen bg-stone-50">
	<header class="border-b border-stone-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
			<a href={navigation.workspaceHref} class="hidden text-lg font-bold text-stone-900 sm:block">Chronolog</a>
			<h1 class="min-w-0 flex-1 text-base font-semibold text-stone-800 sm:text-lg">Trash</h1>
			<a
				href={navigation.workspaceHref}
				class="flex-shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
				data-testid="trash-back-to-app"
			>
				Back<span class="hidden sm:inline">&nbsp;to app</span>
			</a>
		</div>
	</header>
	<ConnectionStatus />

	<main class="mx-auto max-w-3xl px-2 py-4 sm:px-4 sm:py-6">
		<p class="mb-3 px-1 text-sm text-stone-500">Deleted notes stay here for 30 days, then they are removed for good.</p>
		{#if errorMessage}
			<p class="px-1 text-sm text-red-600" role="alert">{errorMessage}</p>
			<button type="button" onclick={load} class="mt-2 px-1 text-sm text-blue-600 hover:text-blue-800">Try again</button>
		{:else if notes === null}
			<p class="px-1 text-sm text-stone-500">Loading…</p>
		{:else if notes.length === 0}
			<p class="px-1 text-sm text-stone-500" data-testid="trash-empty">The trash is empty.</p>
		{:else}
			<TrashList {notes} />
		{/if}
	</main>
</div>
