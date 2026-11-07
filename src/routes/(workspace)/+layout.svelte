<script lang="ts">
	/**
	 * The workspace (sidebar, list, timesheet or editor) for every workspace URL:
	 * `/`, `/time/<week>`, `/notes/<contract>`, `/notes/<contract>/<note|new>`, and the client view
	 * `/notes/client/<client>[/<contract>/<note|new>]` (sprint 039-CL), and all notes
	 * `/notes/all[/<contract>/<note|new>]` (sprint 051-UI).
	 * It is a layout so moving between those URLs never remounts the panels; the pages are empty
	 * and the navigation store reads the URL (sprint 027-CL).
	 * `/search` (059-DR, SR-01) lives here too, so the sidebar, Back/Forward and the timer stay
	 * available: its page renders inside the shell in place of the list and content panels.
	 */
	import { page } from '$app/state';
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import ContractsSidebar from '$lib/components/layout/ContractsSidebar.svelte';
	import TimeEntriesPanel from '$lib/components/layout/TimeEntriesPanel.svelte';
	import NoteListPanel from '$lib/components/layout/NoteListPanel.svelte';
	import NoteEditorPanel from '$lib/components/layout/NoteEditorPanel.svelte';
	import FirstRunNotice from '$lib/components/onboarding/FirstRunNotice.svelte';
	import NoteTrashToastHost from '$lib/components/notes/NoteTrashToastHost.svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';
	import { getIsoWeekNumber } from '$lib/utils/iso-week';
	import { ALL_NOTES_LABEL } from '$lib/components/layout/navigation-labels';

	let { children } = $props();

	const nav = getNavigationContext();
	const isSearchRoute = $derived(page.route.id === '/(workspace)/search');
	const searchQuery = $derived((page.url.searchParams.get('q') ?? '').trim());

	// "Chronolog · Notes · Rocket Build" / "Chronolog · Time entries · Week 45"
	const pageTitle = $derived.by(() => {
		if (isSearchRoute) return searchQuery ? `Chronolog · Search · ${searchQuery}` : 'Chronolog · Search';
		if (nav.isTimeEntriesMode) {
			return nav.isHome && nav.layoutMode === 'mobile'
				? 'Chronolog'
				: `Chronolog · Time entries · Week ${getIsoWeekNumber(nav.selectedWeek ?? '')}`;
		}
		if (nav.isAllNotesView) return `Chronolog · Notes · ${ALL_NOTES_LABEL}`;
		const contractName = nav.listClientId
			? (contractDirectory.clientName(nav.listClientId) ?? undefined)
			: nav.selectedContractId
				? contractDirectory.labels[nav.selectedContractId]?.name
				: undefined;
		return contractName ? `Chronolog · Notes · ${contractName}` : 'Chronolog · Notes';
	});
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<AppShell searchPage={isSearchRoute ? children : undefined}>
	{#snippet panel1()}
		<ContractsSidebar />
	{/snippet}

	{#snippet panel2()}
		<FirstRunNotice compact />
		<NoteListPanel />
	{/snippet}

	{#snippet panel3()}
		{#if nav.isTimeEntriesMode}
			<FirstRunNotice />
			<TimeEntriesPanel />
		{:else}
			<NoteEditorPanel />
		{/if}
	{/snippet}
</AppShell>

<!-- "Moved to trash. Undo" lives here, not in the editor panel, so it survives a phone's panel change -->
<NoteTrashToastHost />

{#if !isSearchRoute}{@render children()}{/if}
