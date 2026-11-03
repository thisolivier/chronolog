<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import ContractsSidebar from '$lib/components/layout/ContractsSidebar.svelte';
	import TimeEntriesPanel from '$lib/components/layout/TimeEntriesPanel.svelte';
	import NoteListPanel from '$lib/components/layout/NoteListPanel.svelte';
	import NoteEditorPanel from '$lib/components/layout/NoteEditorPanel.svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';

	const nav = getNavigationContext();

	// "Chronolog · Notes · Rocket Build" / "Chronolog · Time entries"
	const pageTitle = $derived.by(() => {
		if (nav.isTimeEntriesMode) return 'Chronolog · Time entries';
		const contractName = nav.selectedContractId
			? contractDirectory.labels[nav.selectedContractId]?.name
			: undefined;
		return contractName ? `Chronolog · Notes · ${contractName}` : 'Chronolog · Notes';
	});
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<AppShell>
	{#snippet panel1()}
		<ContractsSidebar />
	{/snippet}

	{#snippet panel2()}
		<NoteListPanel />
	{/snippet}

	{#snippet panel3()}
		{#if nav.isTimeEntriesMode}
			<TimeEntriesPanel />
		{:else}
			<NoteEditorPanel />
		{/if}
	{/snippet}
</AppShell>
