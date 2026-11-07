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
		initialContractId = '',
		onCreated,
		onClose
	}: {
		/** Pre-selected date (YYYY-MM-DD); today when omitted */
		initialDate?: string;
		/** The contract being viewed: preselected, never a different one */
		initialContractId?: string;
		onCreated: (created: { entryId: string; date: string }) => void;
		onClose: () => void;
	} = $props();

	let entryDate = $state(untrack(() => initialDate) ?? localDateString());
	let durationText = $state('');
	let selectedContractId = $state(untrack(() => initialContractId));
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
	class="fixed inset-0 z-50 flex items-center justify-center bg-chalk-950/40 p-4"
	onclick={handleBackdropClick}
	role="presentation"
>
	<div
		class="max-h-full w-full max-w-md overflow-y-auto rounded-lg bg-surface p-6 shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="add-entry-title"
	>
		<h2 id="add-entry-title" class="mb-4 text-lg font-semibold text-ink">Add Time Entry</h2>

		<div class="space-y-3">
			<div>
				<label for="entry-date" class="block text-xs font-medium text-ink-muted">Date</label>
				<input
					id="entry-date"
					type="date"
					bind:value={entryDate}
					class="mt-0.5 block w-full rounded-md input-base px-2 py-1.5 text-sm"
				/>
				{#if dateError}<p class="mt-1 text-xs text-rust-600" role="alert">{dateError}</p>{/if}
			</div>

			<div>
				<label for="entry-description" class="block text-xs font-medium text-ink-muted">
					Description
				</label>
				<textarea
					id="entry-description"
					bind:this={descriptionElement}
					bind:value={description}
					onkeydown={handleFieldKeydown}
					rows="2"
					class="mt-0.5 block w-full rounded-md input-base px-2 py-1.5 text-sm"
					placeholder="What did you work on?"
				></textarea>
			</div>

			<div>
				<label for="entry-contract" class="block text-xs font-medium text-ink-muted">Contract</label>
				<div class="mt-0.5">
					<ContractSelect
						id="entry-contract"
						bind:selectedContractId
						invalid={contractError !== ''}
					/>
				</div>
				{#if contractError}<p class="mt-1 text-xs text-rust-600" role="alert">{contractError}</p>{/if}
			</div>

			<div>
				<label for="deliverable-select" class="block text-xs font-medium text-ink-muted">
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
				<label for="work-type-select" class="block text-xs font-medium text-ink-muted">
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
				<label for="entry-duration" class="block text-xs font-medium text-ink-muted">Time</label>
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
			<div class="mt-3 rounded-md bg-rust-50 p-2 text-xs text-rust-600" role="alert">{saveError}</div>
		{/if}

		<div class="mt-4 flex justify-end gap-2">
			<button
				type="button"
				onclick={onClose}
				class="rounded-md btn-secondary px-3 py-1.5 text-sm"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={isSaving}
				class="rounded-md btn-primary px-4 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-70"
			>
				{isSaving ? 'Saving…' : saveError ? 'Retry' : 'Save'}
			</button>
		</div>
	</div>
</div>
