<script lang="ts">
	import { untrack } from 'svelte';
	import CascadeFields from './CascadeFields.svelte';
	import DurationField from './DurationField.svelte';
	import SplitTimeButton from './SplitTimeButton.svelte';
	import { OntologyCascade } from './ontology-cascade.svelte';
	import { cascadeIdForSave } from './ontology-cascade';
	import { describeSaveError } from './save-error';
	import { formatMinutes, formatTimeRange, parseDuration } from '$lib/utils/duration';
	import { captureDraft } from '$lib/stores/capture-draft.svelte';
	import { getDataService } from '$lib/services/context';
	import { revealFocusedField } from './visual-viewport.svelte';
	import type { TimerSaveData } from './timer-api';

	/*
	 * Finish entry (TC-04/TC-05/TC-06). Every control is drawn from the moment of Stop, in a fixed
	 * position: Description, Contract, Deliverable, Work type (one shared OntologyCascade, sprint
	 * 055-DR), Time, then Discard and Save at the bottom. The fields live in the shared capture
	 * store (sprint 053-DR), so collapse, phone Back, another route or a reload find them again;
	 * only the transient state (saving, error messages) is local. The frozen interval is the
	 * server's (or the pending timer's): nothing here extends it.
	 */
	let {
		onSave,
		onDiscard,
		frozenMinutes,
		startTime = '',
		endTime = '',
		layout = 'panel',
		onSplit = undefined
	}: {
		/** Resolves when saved (or when the widget handled a conflict); rejects with the error to show */
		onSave: (data: TimerSaveData) => Promise<void>;
		onDiscard: () => void;
		/** The frozen duration at Stop, in minutes */
		frozenMinutes: number;
		startTime?: string;
		endTime?: string;
		/** 'panel' in the sidebar / footer widget; 'screen' on the phone capture screen (actions pinned) */
		layout?: 'panel' | 'screen';
		/** Split time (stage 5); absent while the split overlay is a stub */
		onSplit?: () => void;
	} = $props();

	const dataService = getDataService();
	const cascade = new OntologyCascade(dataService, () => captureDraft.fields);
	$effect(() => {
		untrack(() => cascade.start());
		return () => cascade.dispose();
	});

	const fields = $derived(captureDraft.fields);
	const frozenRange = $derived(formatTimeRange(startTime || null, endTime || null));
	let isSaving = $state(false);

	let contractError = $state('');
	let timeError = $state('');
	let saveError = $state('');

	// Every edit is written through, so a remount or reload restores it
	$effect(() => {
		void JSON.stringify(captureDraft.fields);
		untrack(() => captureDraft.persist());
	});

	$effect(() => {
		if (fields.contractId) untrack(() => (contractError = ''));
	});

	$effect(() => {
		void fields.timeText;
		untrack(() => (timeError = ''));
	});

	async function handleSave() {
		if (isSaving || captureDraft.isResolving) return;
		isSaving = true;
		saveError = '';
		try {
			// A level still loading after a parent change must settle first: never send a stale pair
			await cascade.settled();
			contractError = fields.contractId ? '' : 'Pick a contract';
			const timeChanged = fields.timeText.trim() !== fields.measuredTimeText;
			const parsedTime = timeChanged ? parseDuration(fields.timeText) : null;
			timeError = parsedTime && !parsedTime.ok ? parsedTime.error : '';
			if (!fields.contractId || timeError) return;

			const saveData: TimerSaveData = {
				contractId: fields.contractId,
				deliverableId: cascadeIdForSave(fields.deliverableId),
				workTypeId: cascadeIdForSave(fields.workTypeId),
				description: fields.description
			};
			if (parsedTime && parsedTime.ok) {
				saveData.durationMinutes = parsedTime.durationMinutes;
				saveData.startTime = parsedTime.kind === 'range' ? parsedTime.startTime : null;
				saveData.endTime = parsedTime.kind === 'range' ? parsedTime.endTime : null;
			}
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

	const isScreen = $derived(layout === 'screen');
	// A Save or Discard in flight anywhere (this form, another widget): neither may start another
	const isResolving = $derived(isSaving || captureDraft.isResolving);
</script>

<div
	class={isScreen ? 'flex min-h-0 flex-1 flex-col' : 'flex flex-col'}
	data-testid="timer-completion-form"
>
	<div
		class="space-y-3 {isScreen ? 'min-h-0 flex-1 scroll-pt-2 scroll-pb-4 overflow-y-auto overscroll-contain px-4 pt-1 pb-4' : ''}"
		onfocusin={isScreen ? revealFocusedField : undefined}
		data-testid="timer-completion-fields"
	>
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<p class="text-[11px] font-semibold tracking-wide text-warning uppercase" data-testid="timer-finish-heading">
					Finish entry
				</p>
				<p class="mt-0.5 flex items-baseline gap-3">
					<span class="text-2xl font-bold text-ink tabular-nums" data-testid="timer-frozen-duration"
						>{formatMinutes(frozenMinutes)}</span
					>
					{#if frozenRange}<span class="text-sm text-ink-muted tabular-nums" data-testid="timer-frozen-range"
							>{frozenRange.replace('-', '–')}</span
						>{/if}
				</p>
			</div>
			<SplitTimeButton {onSplit} />
		</div>

		<div>
			<label for="timer-description" class="block text-xs font-medium text-ink-muted">Description</label>
			<textarea
				id="timer-description"
				bind:value={captureDraft.fields.description}
				onkeydown={handleFieldKeydown}
				rows="2"
				class="mt-0.5 block w-full rounded-control input-base px-2 py-1.5 text-sm"
				placeholder="What did you work on?"
			></textarea>
		</div>

		<CascadeFields
			{cascade}
			ids={{ contract: 'timer-contract', deliverable: 'timer-deliverable', workType: 'timer-work-type' }}
			{contractError}
			size={isScreen ? 'regular' : 'compact'}
		/>

		<div>
			<label for="timer-time" class="block text-xs font-medium text-ink-muted">Time</label>
			<div class="mt-0.5">
				<DurationField
					id="timer-time"
					bind:value={captureDraft.fields.timeText}
					errorMessage={timeError}
					measuredText={fields.measuredTimeText}
					compact={!isScreen}
					onkeydown={handleFieldKeydown}
				/>
			</div>
		</div>

		{#if saveError}
			<div class="rounded-control bg-rust-50 p-2 text-xs text-rust-600" role="alert">{saveError}</div>
		{/if}
	</div>

	<!-- Anchored actions: below the fields in the sidebar, pinned above the keyboard on a phone -->
	<div
		class="flex gap-2 border-t border-divider {isScreen
			? 'shrink-0 bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
			: 'mt-3 justify-end pt-3'}"
		data-testid="timer-completion-actions"
	>
		<button
			type="button"
			onclick={onDiscard}
			disabled={isResolving}
			class="rounded-control btn-secondary disabled:cursor-wait disabled:opacity-60 px-3 py-1.5 text-sm whitespace-nowrap {isScreen ? 'min-h-11 flex-1' : ''}"
		>
			Discard
		</button>
		<button
			type="button"
			onclick={handleSave}
			disabled={isResolving}
			class="rounded-control btn-primary px-4 py-1.5 text-sm font-medium whitespace-nowrap disabled:cursor-wait disabled:opacity-70 {isScreen
				? 'min-h-11 flex-1'
				: ''}"
		>
			{isSaving ? 'Saving…' : saveError ? 'Retry' : 'Save'}
		</button>
	</div>
</div>
