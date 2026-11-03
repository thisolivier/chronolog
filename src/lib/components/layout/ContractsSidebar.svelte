<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import { getClientDotClass } from '$lib/utils/client-colors';
	import TimerWidget from '$lib/components/timer/TimerWidget.svelte';
	import ContractCreateModal from '$lib/components/admin/ContractCreateModal.svelte';
	import type { ContractsByClientResult, ClientSummary } from '$lib/services/types';
	import { NOTES_CHANGED_EVENT } from '$lib/services/notes-changed-event';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';
	import { groupContractsByClient } from '$lib/utils/group-contracts-by-client';

	const navigationContext = getNavigationContext();
	const dataService = getDataService();

	let contractsList = $state<ContractsByClientResult[]>([]);
	let allClients = $state<ClientSummary[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let showCreateModal = $state(false);

	// Contracts grouped under client headings (archived and system ones never arrive from the API)
	const clientGroups = $derived(groupContractsByClient(contractsList));

	async function loadContracts() {
		try {
			contractsList = await dataService.getContractsByClient();
			contractDirectory.replaceAll(contractsList);
			errorMessage = '';
		} catch (error) {
			// Keep showing the last list if we had one (offline); only an empty sidebar shows the error
			if (contractsList.length === 0) {
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
	<div class="flex-1 overflow-y-auto p-3">
		<!-- Time Entries Link -->
		<button
			onclick={handleTimeEntriesClick}
			class="mb-3 w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors {isTimeEntriesHighlighted
				? 'bg-blue-50 text-blue-700'
				: 'text-stone-700 hover:bg-stone-100'}"
			aria-current={isTimeEntriesHighlighted ? 'page' : undefined}
		>
			Time Entries
		</button>

		<!-- Contracts heading -->
		<div class="mb-2 flex items-center justify-between px-3">
			<span class="text-xs font-semibold uppercase text-stone-400">Contracts</span>
		</div>

		<!-- Contracts grouped by client -->
		{#if isLoading}
			<div class="py-4 text-center text-xs text-stone-400">Loading...</div>
		{:else if errorMessage}
			<div class="rounded-md bg-red-50 p-2 text-xs text-red-600">
				{errorMessage}
			</div>
		{:else if contractsList.length === 0}
			<div class="px-3 py-4 text-xs text-stone-500">
				No contracts yet. Use <span class="font-medium">New Contract</span> below.
			</div>
		{:else}
			{#each clientGroups as group (group.clientId)}
				<div class="mb-2" role="group" aria-label={group.clientName} data-testid="sidebar-client-group">
					<div
						class="flex items-center gap-2 px-3 pt-1 pb-0.5 text-xs font-semibold {navigationContext.selectedClientId ===
						group.clientId
							? 'text-blue-700'
							: 'text-stone-500'}"
						data-testid="sidebar-client-heading"
					>
						<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full {getClientDotClass(group.clientColorIndex)}" aria-hidden="true"></span>
						<span class="truncate">{group.clientName}</span>
					</div>
					{#each group.contracts as contract (contract.id)}
						<button
							onclick={() => handleContractClick(contract.id, contract.clientId)}
							class="flex w-full items-center gap-2 rounded-md py-1.5 pr-3 pl-7 text-left text-sm transition-colors {navigationContext.selectedContractId ===
							contract.id
								? 'bg-blue-50 text-blue-700'
								: 'text-stone-700 hover:bg-stone-100'}"
							class:opacity-50={!contract.isActive}
							data-contract-id={contract.id}
							aria-current={navigationContext.selectedContractId === contract.id ? 'page' : undefined}
						>
							<span class="min-w-0 flex-1 truncate">
								{contract.name}
								{#if !contract.isActive}
									<span class="ml-1 text-xs text-stone-400">(inactive)</span>
								{/if}
							</span>
							{#if contract.noteCount > 0}
								<span
									class="flex-shrink-0 text-[11px] tabular-nums text-stone-400"
									title="{contract.noteCount} {contract.noteCount === 1 ? 'note' : 'notes'}"
									data-testid="sidebar-note-count"
								>
									{contract.noteCount}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		{/if}

	</div>

	<!-- Action buttons just above the timer -->
	<div class="flex-shrink-0 border-t border-stone-200 px-3 py-1.5">
		<button
			onclick={() => (showCreateModal = true)}
			class="block w-full px-3 py-1 text-left text-xs text-stone-500 hover:text-stone-700"
		>
			New Contract
		</button>
		<a
			href="/settings"
			class="block w-full px-3 py-1 text-left text-xs text-stone-500 hover:text-stone-700"
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
