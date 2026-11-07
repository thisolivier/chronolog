<script lang="ts">
	import { untrack } from 'svelte';
	import { parseDuration } from '$lib/utils/duration';
	import { getDataService } from '$lib/services/context';
	import { getClientBorderClass } from '$lib/utils/client-colors';
	import CascadeSelect from '$lib/components/timer/CascadeSelect.svelte';
	import { OntologyCascade, type CascadeSelection } from '$lib/components/timer/ontology-cascade.svelte';
	import { cascadeIdForSave } from '$lib/components/timer/ontology-cascade';
	import DurationField from '$lib/components/timer/DurationField.svelte';
	import { describeSaveError } from '$lib/components/timer/save-error';
	import WikiLinkInput from './WikiLinkInput.svelte';
	import type { ContractOption, CreateTimeEntryInput } from '$lib/services/types';

	const dataService = getDataService();

	let {
		date,
		onEntryCreated,
		onCancel
	}: {
		date: string;
		/** Called with the created entry's id, so the timesheet can focus its card */
		onEntryCreated: (entryId: string) => void;
		onCancel: () => void;
	} = $props();

	const fieldIdPrefix = $derived(`new-entry-${date}`);

	// Contract → deliverable → work type: the shared cascade (sole option, not applicable,
	// failed load with Retry; a contract change keeps valid children and clears the rest)
	let selection = $state<CascadeSelection>({ contractId: '', deliverableId: '', workTypeId: '' });
	const cascade = new OntologyCascade(dataService, () => selection);
	$effect(() => {
		untrack(() => cascade.start());
		return () => cascade.dispose();
	});
	const selectedContractId = $derived(selection.contractId);
	let descriptionInput = $state('');
	let timeInputValue = $state('');
	let isSubmitting = $state(false);

	// Messages shown under the fields after a save attempt; cleared as the user fixes them
	let contractError = $state('');
	let timeError = $state('');
	let saveError = $state('');

	// Load contracts so we can look up clientColorIndex for the selected contract
	let contractList: ContractOption[] = $state([]);

	async function loadContracts() {
		try {
			contractList = await dataService.getContracts();
		} catch {
			// The colour border stays neutral; the select reports its own state
		}
	}

	$effect(() => {
		loadContracts();
	});

	$effect(() => {
		if (selectedContractId) untrack(() => (contractError = ''));
	});

	$effect(() => {
		void timeInputValue;
		untrack(() => (timeError = ''));
	});

	let selectedClientColorIndex = $derived.by(() => {
		if (!selectedContractId) return null;
		const matchingContract = contractList.find((contract) => contract.id === selectedContractId);
		return matchingContract?.clientColorIndex ?? null;
	});

	let leftBorderClass = $derived(
		selectedClientColorIndex !== null
			? `border-l-[3px] ${getClientBorderClass(selectedClientColorIndex)}`
			: 'border-l-[3px] border-l-divider'
	);

	async function handleSubmit() {
		if (isSubmitting) return;
		saveError = '';

		const parsed = parseDuration(timeInputValue);
		contractError = selectedContractId ? '' : 'Pick a contract';
		timeError = parsed.ok ? '' : parsed.error;
		if (!parsed.ok || !selectedContractId) return;

		isSubmitting = true;
		try {
			// Never send a pair from before the last pick's options arrived
			await cascade.settled();
			const entryData: CreateTimeEntryInput = {
				date,
				durationMinutes: parsed.durationMinutes,
				contractId: selectedContractId,
				deliverableId: cascadeIdForSave(selection.deliverableId) || null,
				workTypeId: cascadeIdForSave(selection.workTypeId) || null,
				description: descriptionInput.trim() || undefined
			};

			if (parsed.kind === 'range') {
				entryData.startTime = parsed.startTime;
				entryData.endTime = parsed.endTime;
			}

			const created = await dataService.createTimeEntry(entryData);
			onEntryCreated(created.id);
		} catch (error) {
			saveError = describeSaveError(error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleSubmit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
		}
	}

	function handleDescriptionInput(newValue: string) {
		descriptionInput = newValue;
	}
</script>

<div class="mb-2 rounded-lg border border-divider bg-surface p-4 {leftBorderClass}">
	<!-- Row 1: Description (full width) -->
	<WikiLinkInput
		bind:value={descriptionInput}
		placeholder="What did you work on?"
		onInput={handleDescriptionInput}
		onKeydown={handleKeydown}
		autofocus
	/>

	<!-- Row 2: Contract, Deliverable (+ Work type), Time.
	     Phone: contract on its own line, the rest two per line; wider: one row. -->
	<div class="mt-3 grid grid-cols-2 items-start gap-x-3 gap-y-2 sm:flex">
		<div class="col-span-2 min-w-0 sm:flex-[2]">
			<label for="{fieldIdPrefix}-contract" class="mb-1 block text-xs font-medium text-ink-faint">
				Contract
			</label>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div onkeydown={handleKeydown}>
				<CascadeSelect
					level="contract"
					id="{fieldIdPrefix}-contract"
					state={cascade.contract}
					value={selection.contractId}
					onChoose={(contractId) => cascade.chooseContract(contractId)}
					onRetry={() => cascade.retry('contract')}
					invalid={contractError !== ''}
				/>
			</div>
			{#if contractError}
				<p class="mt-1 text-xs text-rust-600" role="alert">{contractError}</p>
			{/if}
		</div>

		<div class="min-w-0 sm:flex-[1.5]">
			<label for="{fieldIdPrefix}-deliverable" class="mb-1 block text-xs font-medium text-ink-faint">
				Deliverable
			</label>
			<CascadeSelect
				level="deliverable"
				id="{fieldIdPrefix}-deliverable"
				state={cascade.deliverable}
				value={selection.deliverableId}
				onChoose={(deliverableId) => cascade.chooseDeliverable(deliverableId)}
				onRetry={() => cascade.retry('deliverable')}
			/>
		</div>

		<!-- Work type: always drawn ("Choose a deliverable first", "Not applicable"), so nothing pops in -->
		<div class="min-w-0 sm:flex-1">
			<label for="{fieldIdPrefix}-work-type" class="mb-1 block text-xs font-medium text-ink-faint">
				Work type
			</label>
			<CascadeSelect
				level="workType"
				id="{fieldIdPrefix}-work-type"
				state={cascade.workType}
				value={selection.workTypeId}
				onChoose={(workTypeId) => cascade.chooseWorkType(workTypeId)}
				onRetry={() => cascade.retry('workType')}
			/>
		</div>

		<div class="min-w-0 sm:w-40 sm:flex-none">
			<label for="{fieldIdPrefix}-time" class="mb-1 block text-xs font-medium text-ink-faint">
				Time
			</label>
			<DurationField
				id="{fieldIdPrefix}-time"
				bind:value={timeInputValue}
				errorMessage={timeError}
				compact={true}
				onkeydown={handleKeydown}
			/>
		</div>
	</div>

	<!-- Row 3: messages and actions -->
	<div class="mt-3 flex items-center justify-end gap-2">
		{#if saveError}
			<p class="mr-auto text-xs text-rust-600" role="alert">{saveError}</p>
		{/if}
		<button
			onclick={onCancel}
			class="rounded-md px-3 py-1.5 text-sm btn-quiet"
			type="button"
		>
			Cancel
		</button>
		<button
			onclick={handleSubmit}
			disabled={isSubmitting}
			class="rounded-md btn-primary px-3 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-70"
			type="button"
		>
			{isSubmitting ? 'Saving…' : saveError ? 'Retry' : 'Save'}
		</button>
	</div>
</div>
