<script lang="ts">
	import { untrack } from 'svelte';
	import ContractSelect from './ContractSelect.svelte';
	import DeliverableSelect from './DeliverableSelect.svelte';
	import WorkTypeSelect from './WorkTypeSelect.svelte';
	import DurationField from './DurationField.svelte';
	import { describeSaveError } from './save-error';
	import { localDateString } from './local-date';
	import { parseDuration } from '$lib/utils/duration';
	import { getDataService } from '$lib/services/context';
	import type { CreateTimeEntryInput } from '$lib/services/types';

	const dataService = getDataService();

	let {
		initialDate = undefined,
		onCreated,
		onClose
	}: {
		/** Pre-selected date (YYYY-MM-DD); today when omitted */
		initialDate?: string;
		onCreated: (created: { entryId: string; date: string }) => void;
		onClose: () => void;
	} = $props();

	let entryDate = $state(untrack(() => initialDate) ?? localDateString());
	let durationText = $state('');
	let selectedContractId = $state('');
	let selectedDeliverableId = $state('');
	let selectedWorkTypeId = $state('');
	let workTypesAvailable = $state(false);
	let description = $state('');
	let isSaving = $state(false);

	let dateError = $state('');
	let contractError = $state('');
	let durationError = $state('');
	let saveError = $state('');

	let descriptionElement: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		descriptionElement?.focus();
	});

	// A deliverable belongs to a contract: changing the contract clears the deliverable chain
	$effect(() => {
		void selectedContractId;
		untrack(() => {
			selectedDeliverableId = '';
			selectedWorkTypeId = '';
			if (selectedContractId) contractError = '';
		});
	});

	$effect(() => {
		void durationText;
		untrack(() => (durationError = ''));
	});

	async function handleSave() {
		if (isSaving) return;
		saveError = '';
		const parsed = parseDuration(durationText);
		dateError = entryDate ? '' : 'Pick a date';
		contractError = selectedContractId ? '' : 'Pick a contract';
		durationError = parsed.ok ? '' : parsed.error;
		if (!parsed.ok || !entryDate || !selectedContractId) return;

		isSaving = true;
		try {
			const entryData: CreateTimeEntryInput = {
				date: entryDate,
				durationMinutes: parsed.durationMinutes,
				contractId: selectedContractId,
				deliverableId: selectedDeliverableId || null,
				workTypeId: selectedWorkTypeId || null,
				description: description.trim() || undefined
			};
			if (parsed.kind === 'range') {
				entryData.startTime = parsed.startTime;
				entryData.endTime = parsed.endTime;
			}
			const created = await dataService.createTimeEntry(entryData);
			onCreated({ entryId: created.id, date: entryDate });
		} catch (caughtError) {
			saveError = describeSaveError(caughtError);
		} finally {
			isSaving = false;
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) onClose();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}

	/** Enter in a single-line field saves (the description textarea keeps Shift+Enter for newlines) */
	function handleFieldKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSave();
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
	onclick={handleBackdropClick}
	role="presentation"
>
	<div
		class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="add-entry-title"
	>
		<h2 id="add-entry-title" class="mb-4 text-lg font-semibold text-stone-900">Add Time Entry</h2>

		<div class="space-y-3">
			<div>
				<label for="entry-date" class="block text-xs font-medium text-stone-600">Date</label>
				<input
					id="entry-date"
					type="date"
					bind:value={entryDate}
					class="mt-0.5 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				{#if dateError}<p class="mt-1 text-xs text-red-600" role="alert">{dateError}</p>{/if}
			</div>

			<div>
				<label for="entry-description" class="block text-xs font-medium text-stone-600">
					Description
				</label>
				<textarea
					id="entry-description"
					bind:this={descriptionElement}
					bind:value={description}
					onkeydown={handleFieldKeydown}
					rows="2"
					class="mt-0.5 block w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="What did you work on?"
				></textarea>
			</div>

			<div>
				<label for="entry-contract" class="block text-xs font-medium text-stone-600">Contract</label>
				<div class="mt-0.5">
					<ContractSelect
						id="entry-contract"
						bind:selectedContractId
						invalid={contractError !== ''}
					/>
				</div>
				{#if contractError}<p class="mt-1 text-xs text-red-600" role="alert">{contractError}</p>{/if}
			</div>

			<div>
				<label for="deliverable-select" class="block text-xs font-medium text-stone-600">
					Deliverable
				</label>
				<div class="mt-0.5">
					<DeliverableSelect
						id="deliverable-select"
						contractId={selectedContractId}
						bind:selectedDeliverableId
						alwaysRender={true}
					/>
				</div>
			</div>

			<div class:hidden={!workTypesAvailable}>
				<label for="work-type-select" class="block text-xs font-medium text-stone-600">
					Work type
				</label>
				<div class="mt-0.5">
					<WorkTypeSelect
						id="work-type-select"
						deliverableId={selectedDeliverableId}
						bind:selectedWorkTypeId
						bind:hasWorkTypes={workTypesAvailable}
					/>
				</div>
			</div>

			<div>
				<label for="entry-duration" class="block text-xs font-medium text-stone-600">Time</label>
				<div class="mt-0.5">
					<DurationField
						id="entry-duration"
						bind:value={durationText}
						errorMessage={durationError}
						onkeydown={handleFieldKeydown}
					/>
				</div>
			</div>
		</div>

		{#if saveError}
			<div class="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-600" role="alert">{saveError}</div>
		{/if}

		<div class="mt-4 flex justify-end gap-2">
			<button
				type="button"
				onclick={onClose}
				class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={isSaving}
				class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
			>
				{isSaving ? 'Saving…' : saveError ? 'Retry' : 'Save'}
			</button>
		</div>
	</div>
</div>
