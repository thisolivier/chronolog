<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import { formatContractLabel } from './contract-label';
	import type { ContractOption } from '$lib/services/types';

	const dataService = getDataService();

	let {
		selectedContractId = $bindable(''),
		compact = false,
		id = undefined,
		invalid = false,
		autofocus = false,
		onkeydown = undefined,
		onblur = undefined
	}: {
		selectedContractId: string;
		compact?: boolean;
		id?: string;
		/** Red border when a form reported "Pick a contract" */
		invalid?: boolean;
		autofocus?: boolean;
		onkeydown?: (event: KeyboardEvent) => void;
		onblur?: (event: FocusEvent) => void;
	} = $props();

	let contractList: ContractOption[] = $state([]);
	let isLoaded = $state(false);
	let selectElement: HTMLSelectElement | undefined = $state();

	async function loadContracts() {
		try {
			contractList = await dataService.getContracts();
		} catch {
			// Contract list stays empty; the form reports the missing contract on submit
		}
		isLoaded = true;
	}

	$effect(() => {
		loadContracts();
	});

	$effect(() => {
		if (autofocus && isLoaded) selectElement?.focus();
	});

	const borderClasses = $derived(
		invalid
			? 'border-red-400 focus:border-red-500 focus:ring-red-500'
			: 'border-stone-300 focus:border-blue-500 focus:ring-blue-500'
	);
	const sizeClasses = $derived(
		compact ? 'rounded px-1.5 py-1 text-sm' : 'rounded-md px-2 py-1.5 text-sm shadow-sm'
	);
</script>

<select
	bind:this={selectElement}
	{id}
	bind:value={selectedContractId}
	{onkeydown}
	{onblur}
	aria-invalid={invalid}
	class="block w-full min-w-0 border bg-white focus:ring-1 focus:outline-none {sizeClasses} {borderClasses}"
	disabled={!isLoaded}
>
	<option value="">Select a contract…</option>
	{#each contractList as contract (contract.id)}
		<option value={contract.id}>
			{formatContractLabel(contract.clientName, contract.name)}
		</option>
	{/each}
</select>
