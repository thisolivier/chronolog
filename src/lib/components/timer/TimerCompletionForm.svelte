<script lang="ts">
	import { untrack } from 'svelte';
	import ContractSelect from './ContractSelect.svelte';
	import DeliverableSelect from './DeliverableSelect.svelte';
	import WorkTypeSelect from './WorkTypeSelect.svelte';
	import DurationField from './DurationField.svelte';
	import { describeSaveError } from './save-error';
	import { parseDuration } from '$lib/utils/duration';
	import { captureDraft } from '$lib/stores/capture-draft.svelte';
	import type { TimerSaveData } from './timer-api';

	/*
	 * The fields live in the shared capture store (sprint 053-DR), opened by TimerWidget when the
	 * timer stopped: collapse, phone Back, another route or a reload all find them again. Only
	 * the transient state (saving, error messages) is local.
	 */
	let {
		onSave,
		onDiscard
	}: {
		/** Resolves when saved; rejects with the error to show */
		onSave: (data: TimerSaveData) => Promise<void>;
		onDiscard: () => void;
	} = $props();

	const fields = $derived(captureDraft.fields);
	let workTypesAvailable = $state(false);
	let isSaving = $state(false);

	let contractError = $state('');
	let timeError = $state('');
	let saveError = $state('');

	// Every edit is written through, so a remount or reload restores it
	$effect(() => {
		void JSON.stringify(captureDraft.fields);
		untrack(() => captureDraft.persist());
	});

	// A deliverable belongs to a contract: changing the contract clears the deliverable chain
	let previousContractId = untrack(() => captureDraft.fields.contractId);
	$effect(() => {
		const contractId = fields.contractId;
		untrack(() => {
			if (contractId !== previousContractId) {
				captureDraft.fields.deliverableId = '';
				captureDraft.fields.workTypeId = '';
				previousContractId = contractId;
			}
			if (contractId) contractError = '';
		});
	});

	$effect(() => {
		void fields.timeText;
		untrack(() => (timeError = ''));
	});

	async function handleSave() {
		if (isSaving) return;
		saveError = '';
		contractError = fields.contractId ? '' : 'Pick a contract';

		const timeChanged = fields.timeText.trim() !== fields.measuredTimeText;
		const parsedTime = timeChanged ? parseDuration(fields.timeText) : null;
		timeError = parsedTime && !parsedTime.ok ? parsedTime.error : '';
		if (!fields.contractId || timeError) return;

		const saveData: TimerSaveData = {
			contractId: fields.contractId,
			deliverableId: fields.deliverableId,
			workTypeId: fields.workTypeId,
			description: fields.description
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
	<p class="text-xs font-medium text-ink-faint" data-testid="timer-finish-heading">Finish entry: save or discard it</p>

	<div>
		<label for="timer-description" class="block text-xs font-medium text-ink-muted">
			Description
		</label>
		<textarea
			id="timer-description"
			bind:value={captureDraft.fields.description}
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
				bind:selectedContractId={captureDraft.fields.contractId}
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
				contractId={fields.contractId}
				bind:selectedDeliverableId={captureDraft.fields.deliverableId}
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
				deliverableId={fields.deliverableId}
				bind:selectedWorkTypeId={captureDraft.fields.workTypeId}
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
				bind:value={captureDraft.fields.timeText}
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
