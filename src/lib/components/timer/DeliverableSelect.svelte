<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import type { DeliverableOption } from '$lib/services/types';

	const dataService = getDataService();

	let {
		contractId,
		selectedDeliverableId = $bindable(''),
		compact = false,
		alwaysRender = false,
		id = undefined,
		onChange = undefined
	}: {
		contractId: string;
		selectedDeliverableId: string;
		compact?: boolean;
		/** Render a disabled placeholder select when the contract has no deliverables */
		alwaysRender?: boolean;
		id?: string;
		/** Fired after the user picks a deliverable (empty string = none) */
		onChange?: (deliverableId: string) => void;
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
			? 'block w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
			: 'block w-full min-w-0 rounded-md input-base bg-white px-2 py-1.5 text-sm'
	);

	function handleChange(event: Event) {
		const nextDeliverableId = (event.currentTarget as HTMLSelectElement).value;
		selectedDeliverableId = nextDeliverableId;
		onChange?.(nextDeliverableId);
	}
</script>

{#if isLoaded && hasDeliverables}
	<select {id} bind:value={selectedDeliverableId} onchange={handleChange} class={selectClasses}>
		<option value="">No deliverable</option>
		{#each deliverableList as deliverable (deliverable.id)}
			<option value={deliverable.id}>{deliverable.name}</option>
		{/each}
	</select>
{:else if alwaysRender}
	<select {id} disabled class="{selectClasses} text-stone-400">
		<option value="">
			{!contractId ? 'Pick a contract first' : isLoaded ? 'No deliverables' : 'Loading...'}
		</option>
	</select>
{/if}
