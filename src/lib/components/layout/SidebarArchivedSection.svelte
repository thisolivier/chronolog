<!--
	SidebarArchivedSection — the Archived item at the bottom of the contracts sidebar (sprint 033-CL).
	A toggle button (aria-expanded) with a count badge; expanded, it lists archived clients with their
	contracts, and archived contracts of active clients under their client name, in the sidebar's
	grammar but muted. Collapsed by default; the choice is remembered per browser. When the open
	contract is archived, the section expands (without changing the remembered choice) so the
	selection is visible.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import SidebarClientGroup from './SidebarClientGroup.svelte';
	import { browserLocalStorage, readArchivedExpanded, writeArchivedExpanded } from './archived-section-state';
	import type { ClientGroup } from '$lib/utils/group-contracts-by-client';
	import type { ContractsByClientResult } from '$lib/services/types';

	let {
		groups,
		contractCount,
		selectedContractId,
		selectionIsArchived,
		onSelect
	}: {
		groups: ClientGroup<ContractsByClientResult>[];
		contractCount: number;
		selectedContractId: string | null;
		selectionIsArchived: boolean;
		onSelect: (contractId: string, clientId: string) => void;
	} = $props();

	let isExpanded = $state(readArchivedExpanded(browserLocalStorage()));

	function toggle() {
		isExpanded = !isExpanded;
		writeArchivedExpanded(browserLocalStorage(), isExpanded);
	}

	// Opening an archived contract (click, URL, link) shows it; a later collapse by hand is respected
	$effect(() => {
		if (selectedContractId && selectionIsArchived) {
			untrack(() => {
				if (!isExpanded) isExpanded = true;
			});
		}
	});
</script>

<div class="mt-3 border-t border-stone-200 pt-2" data-testid="sidebar-archived-section">
	<!-- The chevron sits in the right-hand column shared with the client chevrons (051-UI): same
	     box (h-5 w-5, w-8 on touch) and the same right inset (pr-1) -->
	<button
		type="button"
		onclick={toggle}
		class="flex w-full items-center gap-2 rounded-md py-1.5 pr-1 pl-3 text-left text-xs font-semibold uppercase text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 pointer-coarse:py-3.5"
		aria-expanded={isExpanded}
		aria-controls="sidebar-archived-list"
		data-testid="sidebar-archived-toggle"
	>
		<span class="flex-1">Archived</span>
		<span
			class="rounded-full bg-stone-200/70 px-1.5 text-[11px] font-medium normal-case tabular-nums text-stone-500"
			title="{contractCount} archived {contractCount === 1 ? 'contract' : 'contracts'}"
			data-testid="sidebar-archived-count"
		>
			{contractCount}
		</span>
		<span
			class="flex h-5 w-5 flex-shrink-0 items-center justify-center pointer-coarse:w-8"
			data-testid="sidebar-archived-chevron"
		>
			<svg
				class="h-3 w-3 transition-transform {isExpanded ? 'rotate-90' : ''}"
				viewBox="0 0 12 12"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				aria-hidden="true"
			>
				<path d="M4.5 2.5 8 6l-3.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
	</button>
	<div id="sidebar-archived-list" class="mt-1" hidden={!isExpanded}>
		{#each groups as group (group.clientId)}
			<SidebarClientGroup {group} {selectedContractId} muted testId="sidebar-archived-client-group" {onSelect} />
		{/each}
	</div>
</div>
