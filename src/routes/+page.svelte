<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import ContractsSidebar from '$lib/components/layout/ContractsSidebar.svelte';
	import WeekListPanel from '$lib/components/layout/WeekListPanel.svelte';
	import TimeEntriesPanel from '$lib/components/layout/TimeEntriesPanel.svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';

	let { data } = $props();
	const nav = getNavigationContext();
</script>

<AppShell>
	{#snippet panel1()}
		<ContractsSidebar userName={data.user?.name || ''} userEmail={data.user?.email || ''} />
	{/snippet}

	{#snippet panel2()}
		{#if nav.isTimeEntriesMode}
			<WeekListPanel />
		{:else}
			<!-- Notes list placeholder (Task 7) -->
			<div class="flex h-full items-center justify-center p-4">
				<p class="text-sm text-gray-400">Notes coming soon</p>
			</div>
		{/if}
	{/snippet}

	{#snippet panel3()}
		{#if nav.isTimeEntriesMode}
			<TimeEntriesPanel />
		{:else}
			<!-- Note editor placeholder (Task 7) -->
			<div class="flex h-full items-center justify-center p-4">
				<p class="text-sm text-gray-400">Select a note to view</p>
			</div>
		{/if}
	{/snippet}
</AppShell>
