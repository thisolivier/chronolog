<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import ContractsSidebar from '$lib/components/layout/ContractsSidebar.svelte';
	import WeekListPanel from '$lib/components/layout/WeekListPanel.svelte';
	import TimeEntriesPanel from '$lib/components/layout/TimeEntriesPanel.svelte';
	import NoteListPanel from '$lib/components/layout/NoteListPanel.svelte';
	import NoteEditorPanel from '$lib/components/layout/NoteEditorPanel.svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';

	const nav = getNavigationContext();
</script>

<AppShell>
	{#snippet panel1()}
		<ContractsSidebar />
	{/snippet}

	{#snippet panel2()}
		{#if nav.isTimeEntriesMode}
			<WeekListPanel />
		{:else}
			<NoteListPanel />
		{/if}
	{/snippet}

	{#snippet panel3()}
		{#if nav.isTimeEntriesMode}
			<TimeEntriesPanel />
		{:else}
			<NoteEditorPanel />
		{/if}
	{/snippet}
</AppShell>
