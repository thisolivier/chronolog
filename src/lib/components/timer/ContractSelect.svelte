<script lang="ts">
	import type { ContractOption } from './timer-api';

	let {
		selectedContractId = $bindable(''),
		compact = false
	}: {
		selectedContractId: string;
		compact?: boolean;
	} = $props();

	let contractList: ContractOption[] = $state([]);
	let isLoaded = $state(false);

	async function loadContracts() {
		try {
			const response = await fetch('/api/contracts');
			if (response.ok) {
				contractList = await response.json();
			}
		} catch {
			// Silently fail — contract list will remain empty
		}
		isLoaded = true;
	}

	$effect(() => {
		loadContracts();
	});

	const selectClasses = $derived(
		compact
			? 'block w-full rounded border border-gray-300 px-1.5 py-1 text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
			: 'block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
	);
</script>

<select bind:value={selectedContractId} class={selectClasses} disabled={!isLoaded}>
	<option value="">Select a contract...</option>
	{#each contractList as contract (contract.id)}
		<option value={contract.id}>
			{contract.name} — {contract.clientName}
		</option>
	{/each}
</select>
