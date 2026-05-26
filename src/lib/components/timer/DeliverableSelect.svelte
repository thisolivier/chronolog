<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import type { DeliverableOption } from '$lib/services/types';

	const dataService = getDataService();

	let {
		contractId,
		selectedDeliverableId = $bindable(''),
		compact = false
	}: {
		contractId: string;
		selectedDeliverableId: string;
		compact?: boolean;
	} = $props();

	let deliverableList: DeliverableOption[] = $state([]);
	let isLoaded = $state(false);
	let lastLoadedContractId = $state('');

	async function loadDeliverables(targetContractId: string) {
		if (!targetContractId) {
			deliverableList = [];
			isLoaded = true;
			return;
		}
		try {
			deliverableList = await dataService.getDeliverables(targetContractId);
		} catch {
			deliverableList = [];
		}
		lastLoadedContractId = targetContractId;
		isLoaded = true;
	}

	// Reload deliverables when contractId changes
	$effect(() => {
		if (contractId !== lastLoadedContractId) {
			isLoaded = false;
			loadDeliverables(contractId);
		}
	});

	const hasDeliverables = $derived(deliverableList.length > 0);

	const selectClasses = $derived(
		compact
			? 'block w-full rounded border border-gray-300 px-1.5 py-1 text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
			: 'block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
	);
</script>

{#if isLoaded && hasDeliverables}
	<select bind:value={selectedDeliverableId} class={selectClasses}>
		<option value="">No deliverable</option>
		{#each deliverableList as deliverable (deliverable.id)}
			<option value={deliverable.id}>{deliverable.name}</option>
		{/each}
	</select>
{/if}
