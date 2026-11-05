<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import { tick } from 'svelte';
	import TimerWidget from '$lib/components/timer/TimerWidget.svelte';
	import ContractCreateModal from '$lib/components/admin/ContractCreateModal.svelte';
	import SidebarClientGroup from './SidebarClientGroup.svelte';
	import SidebarArchivedSection from './SidebarArchivedSection.svelte';
	import SidebarTrashLink from './SidebarTrashLink.svelte';
	import type { ClientSummary } from '$lib/services/types';
	import { NOTES_CHANGED_EVENT } from '$lib/services/notes-changed-event';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';
	import { browserLocalStorage } from './archived-section-state';
	import { readCollapsedClientIds, withClientCollapsed, writeCollapsedClientIds } from './client-collapse-state';
	import { ClientReorderController } from './client-reorder.svelte';

	const navigationContext = getNavigationContext();
	const dataService = getDataService();

	let allClients = $state<ClientSummary[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let showCreateModal = $state(false);
	let navigationElement = $state<HTMLElement | null>(null);

	// Active clients, then one Archived item; the directory store decides which is which (033)
	const sections = $derived(contractDirectory.sections);
	const selectedContractId = $derived(navigationContext.selectedContractId);
	const selectionIsArchived = $derived(contractDirectory.isArchived(selectedContractId));
	const viewedClientId = $derived(navigationContext.listClientId);

	// Collapsed clients, remembered per browser (039-CL); never collapsed by default
	let collapsedClientIds = $state<string[]>(readCollapsedClientIds(browserLocalStorage()));
	function toggleClientCollapsed(clientId: string) {
		collapsedClientIds = withClientCollapsed(collapsedClientIds, clientId, !collapsedClientIds.includes(clientId));
		writeCollapsedClientIds(browserLocalStorage(), collapsedClientIds);
	}

	// Drag or Alt+Arrow to reorder the active clients (039-CL); the focused heading keeps focus
	const clientReorder = new ClientReorderController({
		getOrder: () => sections.activeGroups.map((group) => group.clientId),
		nameOf: (clientId) => contractDirectory.clientName(clientId) ?? 'Client',
		apply: (orderedClientIds) => {
			contractDirectory.applyClientOrder(orderedClientIds);
			const focusedHandle = document.activeElement?.getAttribute('data-client-reorder-handle');
			if (focusedHandle) {
				void tick().then(() =>
					navigationElement?.querySelector<HTMLElement>(`[data-client-reorder-handle="${focusedHandle}"]`)?.focus()
				);
			}
		},
		persist: (orderedClientIds) => dataService.reorderClients(orderedClientIds),
		revert: () => void loadContracts()
	});

	async function loadContracts() {
		try {
			contractDirectory.replaceAll(await dataService.getContractsByClient());
			errorMessage = '';
		} catch (error) {
			// Keep showing the last list if we had one (offline); only an empty sidebar shows the error
			if (contractDirectory.contracts.length === 0) {
				errorMessage = error instanceof Error ? error.message : 'Failed to load contracts';
			}
		} finally {
			isLoading = false;
		}
	}

	// Note counts stay correct: refresh after a note is created, deleted or moved.
	// Several events in a burst (move = note-moved + notes-changed) cause one request.
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	function scheduleCountRefresh() {
		if (refreshTimer) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(loadContracts, 150);
	}

	$effect(() => {
		const refreshEvents = [NOTES_CHANGED_EVENT, 'note-moved'];
		for (const eventName of refreshEvents) window.addEventListener(eventName, scheduleCountRefresh);
		return () => {
			for (const eventName of refreshEvents) window.removeEventListener(eventName, scheduleCountRefresh);
			if (refreshTimer) clearTimeout(refreshTimer);
		};
	});

	async function loadClients() {
		try {
			allClients = await dataService.getClients();
		} catch (error) {
			// Client loading failure is non-critical; the modal will just have an empty dropdown
			console.error('Failed to load clients:', error);
		}
	}

	$effect(() => {
		loadContracts();
		loadClients();
	});

	// Bring a newly selected row on screen (a deep link, a followed link, an archived contract),
	// once per selection so count refreshes never pull the list back
	let lastRevealedContractId: string | null = null;
	$effect(() => {
		if (!selectedContractId || isLoading || selectedContractId === lastRevealedContractId) return;
		lastRevealedContractId = selectedContractId;
		const contractId = selectedContractId;
		void tick().then(() => {
			const selectedRow = navigationElement?.querySelector<HTMLElement>(
				`[data-contract-id="${contractId}"][aria-current="page"]`
			);
			if (selectedRow && selectedRow.offsetParent !== null) selectedRow.scrollIntoView({ block: 'nearest' });
		});
	});

	// Rule 1/3: "Time Entries" is highlighted while the timesheet is on screen; on the phone's
	// home (this list itself) nothing is open, so nothing is highlighted.
	const isTimeEntriesHighlighted = $derived(
		navigationContext.isTimeEntriesMode &&
			!(navigationContext.isHome && navigationContext.layoutMode === 'mobile')
	);

	function handleTimeEntriesClick() {
		navigationContext.selectTimeEntries();
	}

	function handleContractClick(contractId: string, clientId: string) {
		navigationContext.selectContract(contractId, clientId);
	}

	function handleClientClick(clientId: string) {
		navigationContext.selectClient(clientId);
	}

	function handleContractCreated(created?: { id: string; clientId: string }) {
		showCreateModal = false;
		if (created) navigationContext.selectContract(created.id, created.clientId);
		// Reload the contracts list and clients list
		isLoading = true;
		loadContracts();
		loadClients();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Navigation Section (scrollable) -->
	<div class="flex-1 overflow-y-auto p-3" bind:this={navigationElement}>
		<!-- Time Entries Link -->
		<button
			onclick={handleTimeEntriesClick}
			class="mb-3 w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors pointer-coarse:py-3 {isTimeEntriesHighlighted
				? 'bg-blue-50 text-blue-700'
				: 'text-stone-700 hover:bg-stone-100'}"
			aria-current={isTimeEntriesHighlighted ? 'page' : undefined}
		>
			Time Entries
		</button>

		<!-- Contracts heading; its + lines up with the client chevrons below (049-UI) -->
		<div class="mb-2 flex items-center justify-between pr-1 pl-3">
			<span class="text-xs font-semibold uppercase text-stone-400">Contracts</span>
			<button
				type="button"
				onclick={() => (showCreateModal = true)}
				class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-600 pointer-coarse:-my-3 pointer-coarse:h-11 pointer-coarse:w-8"
				aria-label="New contract"
				title="New contract"
				data-testid="sidebar-new-contract"
			>
				<svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
					<path d="M6 2v8M2 6h8" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		<!-- Contracts grouped by client; a one-contract client is a single row -->
		{#if isLoading}
			<div class="py-4 text-center text-xs text-stone-400">Loading...</div>
		{:else if errorMessage}
			<div class="rounded-md bg-red-50 p-2 text-xs text-red-600">
				{errorMessage}
			</div>
		{:else}
			{#if sections.activeGroups.length === 0}
				<div class="px-3 py-4 text-xs text-stone-500">
					No {sections.archivedContractCount > 0 ? 'active ' : ''}contracts yet. Use <span class="font-medium">+</span> next to Contracts.
				</div>
			{/if}
			{#each sections.activeGroups as group (group.clientId)}
				<SidebarClientGroup
					{group}
					{selectedContractId}
					{viewedClientId}
					onSelect={handleContractClick}
					onOpenClient={handleClientClick}
					isCollapsed={collapsedClientIds.includes(group.clientId)}
					onToggleCollapse={toggleClientCollapsed}
					reorder={clientReorder}
				/>
			{/each}
			{#if sections.archivedContractCount > 0}
				<SidebarArchivedSection
					groups={sections.archivedGroups}
					contractCount={sections.archivedContractCount}
					{selectedContractId}
					{selectionIsArchived}
					onSelect={handleContractClick}
				/>
			{/if}
			<SidebarTrashLink withDivider={sections.archivedContractCount === 0} />
		{/if}
		<p class="sr-only" aria-live="polite" data-testid="sidebar-reorder-announcement">{clientReorder.announcement}</p>
	</div>

	<!-- Action buttons just above the timer -->
	<div class="flex-shrink-0 border-t border-stone-200 px-3 py-1.5">
		<a
			href="/settings"
			class="block w-full px-3 py-1 text-left text-xs text-stone-500 hover:text-stone-700 pointer-coarse:py-3.5"
		>
			Settings
		</a>
	</div>

	<!-- Timer Widget at Bottom -->
	<div class="flex-shrink-0 border-t border-stone-200 p-3">
		<TimerWidget />
	</div>

	<!-- Contract Create Modal -->
	{#if showCreateModal}
		<ContractCreateModal
			clients={allClients}
			initialClientId={navigationContext.selectedClientId}
			onCreated={handleContractCreated}
			onClose={() => (showCreateModal = false)}
		/>
	{/if}
</div>
