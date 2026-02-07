<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { resolveRoute } from '$app/paths';
	import TimerWidget from '$lib/components/timer/TimerWidget.svelte';

	interface Client {
		id: string;
		name: string;
		shortCode: string;
		contracts: Array<{
			id: string;
			name: string;
			isActive: boolean;
		}>;
	}

	interface Props {
		userName: string;
		userEmail: string;
	}

	let { userName, userEmail }: Props = $props();

	const navigationContext = getNavigationContext();

	let clients = $state<Client[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');

	// Load contracts grouped by client
	async function loadContractsByClient() {
		try {
			const response = await fetch('/api/contracts-by-client');
			if (!response.ok) throw new Error('Failed to load contracts');

			const data = await response.json();
			clients = data.clients;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load contracts';
		} finally {
			isLoading = false;
		}
	}

	// Load on mount
	$effect(() => {
		loadContractsByClient();
	});

	function handleTimeEntriesClick() {
		navigationContext.selectTimeEntries();
	}

	function handleContractClick(contractId: string, clientId: string) {
		navigationContext.selectContract(contractId, clientId);
	}

	async function handleSignOut() {
		try {
			const response = await fetch('/api/auth/sign-out', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (response.ok) {
				window.location.href = '/login';
			}
		} catch {
			// If sign out fails, still redirect to login
			window.location.href = '/login';
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header Section -->
	<div class="flex-shrink-0 border-b border-gray-200 bg-white p-4">
		<div class="mb-2 text-sm font-bold text-gray-900">Chronolog</div>
		<div class="mb-2 text-xs text-gray-500">
			{userName || userEmail}
		</div>
		<button
			onclick={handleSignOut}
			class="text-xs text-blue-600 hover:text-blue-700 hover:underline"
		>
			Sign out
		</button>
	</div>

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

		<!-- Contracts by Client -->
		{#if isLoading}
			<div class="py-4 text-center text-xs text-gray-400">Loading...</div>
		{:else if errorMessage}
			<div class="rounded-md bg-red-50 p-2 text-xs text-red-600">
				{errorMessage}
			</div>
		{:else if clients.length === 0}
			<div class="py-4 text-center text-xs text-gray-500">No contracts found</div>
		{:else}
			{#each clients as client (client.id)}
				<div class="mb-4">
					<!-- Client Header -->
					<div class="mb-1 px-3 text-xs font-semibold uppercase text-gray-400">
						{client.name}
					</div>

					<!-- Contracts under this client -->
					{#each client.contracts as contract (contract.id)}
						<button
							onclick={() => handleContractClick(contract.id, client.id)}
							class="w-full rounded-md px-3 py-1.5 pl-5 text-left text-sm transition-colors {navigationContext.selectedContractId ===
							contract.id
								? 'bg-blue-50 text-blue-700'
								: 'text-gray-700 hover:bg-gray-100'}"
							class:opacity-50={!contract.isActive}
						>
							{contract.name}
							{#if !contract.isActive}
								<span class="ml-1 text-xs text-gray-400">(inactive)</span>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		{/if}

		<!-- Settings Link -->
		<div class="mt-6 border-t border-gray-200 pt-3">
			<a
				href={resolveRoute('/admin', {})}
				class="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
			>
				Settings
			</a>
		</div>
	</div>

	<!-- Timer Widget at Bottom -->
	<div class="flex-shrink-0 border-t border-gray-200 p-3">
		<TimerWidget />
	</div>
</div>
