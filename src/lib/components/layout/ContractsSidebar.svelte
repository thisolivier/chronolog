<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/sync/context';
	import TimerWidget from '$lib/components/timer/TimerWidget.svelte';
	import ContractCreateModal from '$lib/components/admin/ContractCreateModal.svelte';
	import SyncStatusIndicator from '$lib/components/layout/SyncStatusIndicator.svelte';
	import type { ContractsByClientResult } from '$lib/sync/data-types';

	interface ClientOption {
		id: string;
		name: string;
		shortCode: string;
	}

	const navigationContext = getNavigationContext();
	const dataService = getDataService();

	let contractsList = $state<ContractsByClientResult[]>([]);
	let allClients = $state<ClientOption[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let showCreateModal = $state(false);

	async function loadContracts() {
		try {
			contractsList = await dataService.getContractsByClient();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load contracts';
		} finally {
			isLoading = false;
		}
	}

	async function loadClients() {
		try {
			const response = await fetch('/api/clients');
			if (!response.ok) throw new Error('Failed to load clients');

			const data = await response.json();
			allClients = data.clients;
		} catch (error) {
			// Client loading failure is non-critical; the modal will just have an empty dropdown
			console.error('Failed to load clients:', error);
		}
	}

	$effect(() => {
		loadContracts();
		loadClients();
	});

	function handleTimeEntriesClick() {
		navigationContext.selectTimeEntries();
	}

	function handleContractClick(contractId: string, clientId: string) {
		navigationContext.selectContract(contractId, clientId);
	}

	function handleContractCreated() {
		showCreateModal = false;
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
			class="mb-3 w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors {navigationContext.isTimeEntriesMode
				? 'bg-blue-50 text-blue-700'
				: 'text-gray-700 hover:bg-gray-100'}"
		>
			Time Entries
		</button>

		<!-- Contracts heading -->
		<div class="mb-2 flex items-center justify-between px-3">
			<span class="text-xs font-semibold uppercase text-gray-400">Contracts</span>
		</div>

		<!-- Flat contract list -->
		{#if isLoading}
			<div class="py-4 text-center text-xs text-gray-400">Loading...</div>
		{:else if errorMessage}
			<div class="rounded-md bg-red-50 p-2 text-xs text-red-600">
				{errorMessage}
			</div>
		{:else if contractsList.length === 0}
			<div class="py-4 text-center text-xs text-gray-500">No contracts found</div>
		{:else}
			{#each contractsList as contract (contract.id)}
				<button
					onclick={() => handleContractClick(contract.id, contract.clientId)}
					class="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors {navigationContext.selectedContractId ===
					contract.id
						? 'bg-blue-50 text-blue-700'
						: 'text-gray-700 hover:bg-gray-100'}"
					class:opacity-50={!contract.isActive}
				>
					<!-- Contract name prefixed with emoji or client short code -->
					<div class="min-w-0 flex-1 truncate">
						{#if contract.clientEmoji}
							<span>{contract.clientEmoji} </span>
						{:else}
							<span class="text-gray-400">{contract.clientShortCode}: </span>
						{/if}
						{contract.name}
						{#if !contract.isActive}
							<span class="ml-1 text-xs text-gray-400">(inactive)</span>
						{/if}
					</div>

					<!-- Note count (right-aligned, only if > 0) -->
					{#if contract.noteCount > 0}
						<span class="flex-shrink-0 text-xs text-gray-400">
							{contract.noteCount}
						</span>
					{/if}
				</button>
			{/each}
		{/if}

	</div>

	<!-- Action buttons just above the timer -->
	<div class="flex-shrink-0 border-t border-gray-200 px-3 py-1.5">
		<button
			onclick={() => (showCreateModal = true)}
			class="block w-full px-3 py-1 text-left text-xs text-gray-500 hover:text-gray-700"
		>
			New Contract
		</button>
		<a
			href="/admin"
			class="block w-full px-3 py-1 text-left text-xs text-gray-500 hover:text-gray-700"
		>
			Settings
		</a>
	</div>

	<!-- Sync Status Indicator -->
	<SyncStatusIndicator />

	<!-- Timer Widget at Bottom -->
	<div class="flex-shrink-0 border-t border-gray-200 p-3">
		<TimerWidget />
	</div>

	<!-- Contract Create Modal -->
	{#if showCreateModal}
		<ContractCreateModal
			clients={allClients}
			onCreated={handleContractCreated}
			onClose={() => (showCreateModal = false)}
		/>
	{/if}
</div>
