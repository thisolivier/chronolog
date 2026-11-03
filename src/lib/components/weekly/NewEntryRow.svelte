<script lang="ts">
	import { untrack } from 'svelte';
	import { parseTimeInput } from '$lib/utils/time-parse';
	import { getDataService } from '$lib/services/context';
	import { getClientBorderClass } from '$lib/utils/client-colors';
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';
	import DeliverableSelect from '$lib/components/timer/DeliverableSelect.svelte';
	import WorkTypeSelect from '$lib/components/timer/WorkTypeSelect.svelte';
	import WikiLinkInput from './WikiLinkInput.svelte';
	import type { ContractOption, CreateTimeEntryInput } from '$lib/services/types';

	const dataService = getDataService();

	let {
		date,
		onEntryCreated,
		onCancel
	}: {
		date: string;
		onEntryCreated: () => void;
		onCancel: () => void;
	} = $props();

	let selectedContractId = $state('');
	let selectedDeliverableId = $state('');
	let selectedWorkTypeId = $state('');
	let workTypesAvailable = $state(false);
	let descriptionInput = $state('');
	let timeInputValue = $state('');
	let timeInputError = $state(false);
	let isSubmitting = $state(false);

	// Load contracts so we can look up clientColorIndex for the selected contract
	let contractList: ContractOption[] = $state([]);

	async function loadContracts() {
		try {
			contractList = await dataService.getContracts();
		} catch {
			// Silently fail — contract list will remain empty
		}
	}

	$effect(() => {
		loadContracts();
	});

	// A deliverable belongs to a contract: changing the contract clears the deliverable chain
	$effect(() => {
		void selectedContractId;
		untrack(() => {
			selectedDeliverableId = '';
			selectedWorkTypeId = '';
		});
	});

	// Derive the selected contract's color index for the dynamic left border
	let selectedClientColorIndex = $derived.by(() => {
		if (!selectedContractId) return null;
		const matchingContract = contractList.find(
			(contract) => contract.id === selectedContractId
		);
		return matchingContract?.clientColorIndex ?? null;
	});

	let leftBorderClass = $derived(
		selectedClientColorIndex !== null
			? `border-l-[3px] ${getClientBorderClass(selectedClientColorIndex)}`
			: 'border-l-[3px] border-l-stone-200'
	);

	const canSubmit = $derived(
		selectedContractId !== '' && timeInputValue.trim() !== '' && !timeInputError
	);

	async function handleSubmit() {
		if (isSubmitting) return;

		const parsed = parseTimeInput(timeInputValue);
		if (parsed.type === 'invalid') {
			timeInputError = true;
			return;
		}

		if (!selectedContractId) return;

		isSubmitting = true;
		timeInputError = false;

		try {
			const entryData: CreateTimeEntryInput = {
				date,
				durationMinutes: parsed.durationMinutes,
				contractId: selectedContractId,
				deliverableId: selectedDeliverableId || null,
				workTypeId: selectedWorkTypeId || null,
				description: descriptionInput.trim() || undefined
			};

			if (parsed.type === 'range') {
				entryData.startTime = parsed.startTime;
				entryData.endTime = parsed.endTime;
			}

			await dataService.createTimeEntry(entryData);
			onEntryCreated();
		} catch (error) {
			console.error('Error creating entry:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && canSubmit) {
			handleSubmit();
		} else if (event.key === 'Escape') {
			onCancel();
		}
	}

	function handleTimeInput(event: Event) {
		const input = event.target as HTMLInputElement;
		timeInputValue = input.value;
		// Clear error on typing
		if (timeInputError) {
			timeInputError = false;
		}
	}

	function handleDescriptionInput(newValue: string) {
		descriptionInput = newValue;
	}
</script>

<div
	class="mb-2 rounded-lg border border-stone-200 bg-white p-4 {leftBorderClass}"
>
	<!-- Row 1: Description input (full width) -->
	<WikiLinkInput
		bind:value={descriptionInput}
		placeholder="What did you work on?"
		onInput={handleDescriptionInput}
		onKeydown={handleKeydown}
		autofocus
	/>

	<!-- Row 2: Contract select, Deliverable (+ Work type), Time input -->
	<div class="mt-3 flex items-end gap-3">
		<!-- Contract select -->
		<div class="min-w-0 flex-1">
			<label class="mb-1 block text-xs font-medium text-stone-500">Contract</label>
			<ContractSelect bind:selectedContractId compact={true} />
		</div>

		<!-- Deliverable select (placeholder until the contract has deliverables) -->
		<div class="min-w-0 flex-1">
			<label class="mb-1 block text-xs font-medium text-stone-500">Deliverable</label>
			<DeliverableSelect
				contractId={selectedContractId}
				bind:selectedDeliverableId
				compact={true}
				alwaysRender={true}
			/>
		</div>

		<!-- Work type select: only when the chosen deliverable has work types -->
		<div class="min-w-0 flex-1" class:hidden={!workTypesAvailable}>
			<label class="mb-1 block text-xs font-medium text-stone-500">Work type</label>
			<WorkTypeSelect
				deliverableId={selectedDeliverableId}
				bind:selectedWorkTypeId
				bind:hasWorkTypes={workTypesAvailable}
				compact={true}
			/>
		</div>

		<!-- Time input -->
		<div class="w-28">
			<label class="mb-1 block text-xs font-medium text-stone-500">Time</label>
			<input
				type="text"
				value={timeInputValue}
				oninput={handleTimeInput}
				onkeydown={handleKeydown}
				class="block w-full rounded border px-1.5 py-1 text-sm font-medium tabular-nums focus:ring-1 focus:outline-none {timeInputError
					? 'border-red-400 focus:border-red-500 focus:ring-red-500'
					: 'border-stone-300 focus:border-blue-500 focus:ring-blue-500'}"
				placeholder="2h30m"
			/>
		</div>
	</div>

	<!-- Row 3: Action buttons (bottom right) -->
	<div class="mt-3 flex items-center justify-end gap-2">
		<button
			onclick={onCancel}
			class="text-sm text-stone-500 hover:text-stone-700"
			type="button"
		>
			Cancel
		</button>
		<button
			onclick={handleSubmit}
			disabled={!canSubmit || isSubmitting}
			class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
			type="button"
		>
			{isSubmitting ? 'Saving...' : 'Save'}
		</button>
	</div>
</div>
