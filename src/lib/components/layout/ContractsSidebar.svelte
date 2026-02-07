<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import TimerWidget from '$lib/components/timer/TimerWidget.svelte';
	import ContractCreateModal from '$lib/components/admin/ContractCreateModal.svelte';

	interface ContractItem {
		id: string;
		name: string;
		isActive: boolean;
		clientId: string;
		clientName: string;
		clientShortCode: string;
		noteCount: number;
	}

	const navigationContext = getNavigationContext();

	let contractsList = $state<ContractItem[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let showCreateModal = $state(false);

	/** Extract unique clients from the loaded contracts list */
	let uniqueClients = $derived(() => {
		const seen: Record<string, boolean> = {};
		const result: Array<{ id: string; name: string; shortCode: string }> = [];
		for (const contract of contractsList) {
			if (!seen[contract.clientId]) {
				seen[contract.clientId] = true;
				result.push({
					id: contract.clientId,
					name: contract.clientName,
					shortCode: contract.clientShortCode
				});
			}
		}
		return result;
	});

	async function loadContracts() {
		try {
			const response = await fetch('/api/contracts-by-client');
			if (!response.ok) throw new Error('Failed to load contracts');

			const data = await response.json();
			contractsList = data.contracts;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load contracts';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		loadContracts();
	});

	function handleTimeEntriesClick() {
		navigationContext.selectTimeEntries();
	}

	function handleContractClick(contractId: string, clientId: string) {
		navigationContext.selectContract(contractId, clientId);
	}

	function handleContractCreated() {
		showCreateModal = false;
		// Reload the contracts list
		isLoading = true;
		loadContracts();
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
					<!-- Note count badge -->
					<span
						class="flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-medium {navigationContext.selectedContractId ===
						contract.id
							? 'bg-blue-200 text-blue-800'
							: 'bg-gray-200 text-gray-600'}"
					>
						{contract.noteCount}
					</span>

					<!-- Contract name and client byline -->
					<div class="min-w-0 flex-1">
						<div class="truncate">
							{contract.name}
							{#if !contract.isActive}
								<span class="ml-1 text-xs text-gray-400">(inactive)</span>
							{/if}
						</div>
						<div class="truncate text-xs text-gray-400">{contract.clientName}</div>
					</div>
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

	<!-- Timer Widget at Bottom -->
	<div class="flex-shrink-0 border-t border-gray-200 p-3">
		<TimerWidget />
	</div>

	<!-- Contract Create Modal -->
	{#if showCreateModal}
		<ContractCreateModal
			clients={uniqueClients()}
			onCreated={handleContractCreated}
			onClose={() => (showCreateModal = false)}
		/>
	{/if}
</div>
