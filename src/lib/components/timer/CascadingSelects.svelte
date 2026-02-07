<script lang="ts">
	type Contract = {
		id: string;
		name: string;
		clientName: string;
		clientShortCode: string;
		isActive: boolean;
	};
	type Deliverable = { id: string; name: string };
	type WorkType = { id: string; name: string };

	let {
		selectedContractId = $bindable(''),
		selectedDeliverableId = $bindable(''),
		selectedWorkTypeId = $bindable('')
	}: {
		selectedContractId: string;
		selectedDeliverableId: string;
		selectedWorkTypeId: string;
	} = $props();

	let contractList: Contract[] = $state([]);
	let deliverableList: Deliverable[] = $state([]);
	let workTypeList: WorkType[] = $state([]);

	let contractsLoaded = $state(false);

	/** Fetch contracts for the current user */
	async function loadContracts() {
		const response = await fetch('/api/contracts');
		if (response.ok) {
			contractList = await response.json();
		}
		contractsLoaded = true;
	}

	/** Fetch deliverables when contract changes */
	async function loadDeliverables(contractId: string) {
		if (!contractId) {
			deliverableList = [];
			return;
		}
		const response = await fetch(`/api/deliverables?contractId=${contractId}`);
		if (response.ok) {
			deliverableList = await response.json();
		}
	}

	/** Fetch work types when deliverable changes */
	async function loadWorkTypes(deliverableId: string) {
		if (!deliverableId) {
			workTypeList = [];
			return;
		}
		const response = await fetch(`/api/work-types?deliverableId=${deliverableId}`);
		if (response.ok) {
			workTypeList = await response.json();
		}
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
