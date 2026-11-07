<script lang="ts">
	import { untrack } from 'svelte';
	import ContractSelect from './ContractSelect.svelte';
	import DeliverableSelect from './DeliverableSelect.svelte';
	import WorkTypeSelect from './WorkTypeSelect.svelte';
	import DurationField from './DurationField.svelte';
	import { describeSaveError } from './save-error';
	import { parseDuration, formatDurationInput } from '$lib/utils/duration';
	import type { TimerSaveData } from './timer-api';


	let {
		startTime,
		endTime,
		elapsedSeconds,
		initialContractId = '',
		initialDescription = '',
		onSave,
		onDiscard
	}: {
		startTime: string;
		endTime: string;
		elapsedSeconds: number;
		initialContractId?: string;
		initialDescription?: string;
		/** Resolves when saved; rejects with the error to show */
		onSave: (data: TimerSaveData) => Promise<void>;
		onDiscard: () => void;
	} = $props();

	// The form edits its own copy; later prop changes must not overwrite what the user typed
	const measuredTimeText = untrack(() =>
		formatDurationInput(Math.max(1, Math.ceil(elapsedSeconds / 60)), startTime || null, endTime || null)
	);

	let selectedContractId = $state(untrack(() => initialContractId));
	let selectedDeliverableId = $state('');
	let selectedWorkTypeId = $state('');
	let workTypesAvailable = $state(false);
	let description = $state(untrack(() => initialDescription));
	let timeText = $state(measuredTimeText);
	let isSaving = $state(false);

	let contractError = $state('');
	let timeError = $state('');
	let saveError = $state('');

	// A deliverable belongs to a contract: changing the contract clears the deliverable chain
	let previousContractId = untrack(() => initialContractId);
	$effect(() => {
		const contractId = selectedContractId;
		untrack(() => {
			if (contractId !== previousContractId) {
				selectedDeliverableId = '';
				selectedWorkTypeId = '';
				previousContractId = contractId;
			}
			if (contractId) contractError = '';
		});
	});

	$effect(() => {
		void timeText;
		untrack(() => (timeError = ''));
	});

	async function handleSave() {
		if (isSaving) return;
		saveError = '';
		contractError = selectedContractId ? '' : 'Pick a contract';

		const timeChanged = timeText.trim() !== measuredTimeText;
		const parsedTime = timeChanged ? parseDuration(timeText) : null;
		timeError = parsedTime && !parsedTime.ok ? parsedTime.error : '';
		if (!selectedContractId || timeError) return;

		const saveData: TimerSaveData = {
			contractId: selectedContractId,
			deliverableId: selectedDeliverableId,
			workTypeId: selectedWorkTypeId,
			description
		};
		if (parsedTime && parsedTime.ok) {
			saveData.durationMinutes = parsedTime.durationMinutes;
			saveData.startTime = parsedTime.kind === 'range' ? parsedTime.startTime : null;
			saveData.endTime = parsedTime.kind === 'range' ? parsedTime.endTime : null;
		}

		isSaving = true;
		try {
			await onSave(saveData);
		} catch (error) {
			saveError = describeSaveError(error);
		} finally {
			isSaving = false;
		}
	}

	function handleFieldKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSave();
		}
	}
</script>

<div class="space-y-3">
	<p class="text-xs font-medium text-ink-faint">Timer stopped: save or discard this entry</p>

	<div>
		<label for="timer-description" class="block text-xs font-medium text-ink-muted">
			Description
		</label>
		<textarea
			id="timer-description"
			bind:value={description}
			onkeydown={handleFieldKeydown}
			rows="2"
			class="mt-0.5 block w-full rounded-md input-base px-2 py-1.5 text-sm"
			placeholder="What did you work on?"
		></textarea>
	</div>

	<div>
		<label for="timer-contract" class="block text-xs font-medium text-ink-muted">Contract</label>
		<div class="mt-0.5">
			<ContractSelect
				id="timer-contract"
				bind:selectedContractId
				compact={true}
				invalid={contractError !== ''}
			/>
		</div>
		{#if contractError}<p class="mt-1 text-xs text-rust-600" role="alert">{contractError}</p>{/if}
	</div>

	<div>
		<label for="timer-deliverable" class="block text-xs font-medium text-ink-muted">Deliverable</label>
		<div class="mt-0.5">
			<DeliverableSelect
				id="timer-deliverable"
				contractId={selectedContractId}
				bind:selectedDeliverableId
				compact={true}
				alwaysRender={true}
			/>
		</div>
	</div>

	<div class:hidden={!workTypesAvailable}>
		<label for="timer-work-type" class="block text-xs font-medium text-ink-muted">Work type</label>
		<div class="mt-0.5">
			<WorkTypeSelect
				id="timer-work-type"
				deliverableId={selectedDeliverableId}
				bind:selectedWorkTypeId
				bind:hasWorkTypes={workTypesAvailable}
				compact={true}
			/>
		</div>
	</div>

	<div>
		<label for="timer-time" class="block text-xs font-medium text-ink-muted">Time</label>
		<div class="mt-0.5">
			<DurationField
				id="timer-time"
				bind:value={timeText}
				errorMessage={timeError}
				compact={true}
				onkeydown={handleFieldKeydown}
			/>
		</div>
	</div>

	{#if saveError}
		<div class="rounded-md bg-rust-50 p-2 text-xs text-rust-600" role="alert">{saveError}</div>
	{/if}

	<div class="flex justify-end gap-2">
		<button
			type="button"
			onclick={onDiscard}
			class="rounded-md btn-secondary px-3 py-1.5 text-sm whitespace-nowrap"
		>
			Discard
		</button>
		<button
			type="button"
			onclick={handleSave}
			disabled={isSaving}
			class="rounded-md btn-primary px-4 py-1.5 text-sm font-medium whitespace-nowrap disabled:cursor-wait disabled:opacity-70"
		>
			{isSaving ? 'Saving…' : saveError ? 'Retry' : 'Save'}
		</button>
	</div>
</div>
