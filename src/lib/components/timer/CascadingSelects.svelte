<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import type { ContractOption, DeliverableOption, WorkTypeOption } from '$lib/services/types';

	const dataService = getDataService();

	let {
		selectedContractId = $bindable(''),
		selectedDeliverableId = $bindable(''),
		selectedWorkTypeId = $bindable('')
	}: {
		selectedContractId: string;
		selectedDeliverableId: string;
		selectedWorkTypeId: string;
	} = $props();

	let contractList: ContractOption[] = $state([]);
	let deliverableList: DeliverableOption[] = $state([]);
	let workTypeList: WorkTypeOption[] = $state([]);

	/** Fetch contracts for the current user */
	async function loadContracts() {
		contractList = await dataService.getContracts();
	}

	/** Fetch deliverables when contract changes */
	async function loadDeliverables(contractId: string) {
		if (!contractId) {
			deliverableList = [];
			return;
		}
		deliverableList = await dataService.getDeliverables(contractId);
	}

	/** Fetch work types when deliverable changes */
	async function loadWorkTypes(deliverableId: string) {
		if (!deliverableId) {
			workTypeList = [];
			return;
		}
		workTypeList = await dataService.getWorkTypes(deliverableId);
	}

	// Load contracts on mount
	$effect(() => {
		loadContracts();
	});

	// When contract changes, load deliverables and reset downstream
	$effect(() => {
		if (selectedContractId) {
			loadDeliverables(selectedContractId);
		} else {
			deliverableList = [];
		}
		selectedDeliverableId = '';
		selectedWorkTypeId = '';
	});

	// When deliverable changes, load work types and reset downstream
	$effect(() => {
		if (selectedDeliverableId) {
			loadWorkTypes(selectedDeliverableId);
		} else {
			workTypeList = [];
		}
		selectedWorkTypeId = '';
	});
</script>

<div class="space-y-2">
	<div>
		<label for="contract-select" class="block text-xs font-medium text-gray-600">
			Contract <span class="text-red-500">*</span>
		</label>
		<select
			id="contract-select"
			bind:value={selectedContractId}
			class="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
		>
			<option value="">Select a contract...</option>
			{#each contractList as contract (contract.id)}
				<option value={contract.id}>
					{contract.clientShortCode} / {contract.name}
				</option>
			{/each}
		</select>
	</div>

	{#if selectedContractId && deliverableList.length > 0}
		<div>
			<label for="deliverable-select" class="block text-xs font-medium text-gray-600">
				Deliverable
			</label>
			<select
				id="deliverable-select"
				bind:value={selectedDeliverableId}
				class="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			>
				<option value="">Select a deliverable...</option>
				{#each deliverableList as deliverable (deliverable.id)}
					<option value={deliverable.id}>{deliverable.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	{#if selectedDeliverableId && workTypeList.length > 0}
		<div>
			<label for="work-type-select" class="block text-xs font-medium text-gray-600">
				Work Type
			</label>
			<select
				id="work-type-select"
				bind:value={selectedWorkTypeId}
				class="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			>
				<option value="">Select a work type...</option>
				{#each workTypeList as workType (workType.id)}
					<option value={workType.id}>{workType.name}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>
