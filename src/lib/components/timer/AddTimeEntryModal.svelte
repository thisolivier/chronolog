<!--
	AddTimeEntryModal — manual Add Time Entry (design r1 TC-09, sprint 055-DR). Fields: Date,
	Description, Contract, Deliverable, Work type (the shared OntologyCascade, same rules as the
	completion form), Time (the shared duration / range parser). Cancel and Save.
	Desktop: a centred overlay. Phone: a full-height sheet sized to the visible viewport, so the
	actions stay above the keyboard and the fields scroll. Escape and a backdrop click never throw
	away typed content: ignored while a select has focus (its own list may be open), and they ask
	first when the form is dirty. It never touches a running timer. While open the page is
	scroll-locked (`lockBodyScroll`, iOS) and only the fields' scroller takes touch panning.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import CascadeFields from './CascadeFields.svelte';
	import DurationField from './DurationField.svelte';
	import { OntologyCascade, type CascadeSelection } from './ontology-cascade.svelte';
	import { cascadeIdForSave } from './ontology-cascade';
	import { describeSaveError } from './save-error';
	import { localDateString } from './local-date';
	import { VisualViewportBox, revealFocusedField } from './visual-viewport.svelte';
	import { lockBodyScroll } from '$lib/utils/scroll-lock';
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

	const startingDate = untrack(() => initialDate) ?? localDateString();
	let entryDate = $state(startingDate);
	let durationText = $state('');
	let description = $state('');
	const selection = $state<CascadeSelection>({
		contractId: untrack(() => initialContractId),
		deliverableId: '',
		workTypeId: ''
	});
	const cascade = new OntologyCascade(dataService, () => selection);
	$effect(() => {
		untrack(() => cascade.start());
		return () => cascade.dispose();
	});

	let isSaving = $state(false);
	let dateError = $state('');
	let contractError = $state('');
	let durationError = $state('');
	let saveError = $state('');
	let isConfirmingClose = $state(false);

	let descriptionElement: HTMLTextAreaElement | undefined = $state();
	let keepEditingButton: HTMLButtonElement | undefined = $state();

	const viewportBox = new VisualViewportBox();
	$effect(() => viewportBox.track());
	$effect(() => lockBodyScroll());

	$effect(() => {
		descriptionElement?.focus();
	});

	$effect(() => {
		if (selection.contractId) untrack(() => (contractError = ''));
	});

	$effect(() => {
		void durationText;
		untrack(() => (durationError = ''));
	});

	/** Something the user typed or picked would be lost by closing */
	const isDirty = $derived(
		description.trim() !== '' || durationText.trim() !== '' || entryDate !== startingDate || cascade.touchedByUser
	);

	async function handleSave() {
		if (isSaving) return;
		isSaving = true;
		saveError = '';
		try {
			await cascade.settled();
			const parsed = parseDuration(durationText);
			dateError = entryDate ? '' : 'Pick a date';
			contractError = selection.contractId ? '' : 'Pick a contract';
			durationError = parsed.ok ? '' : parsed.error;
			if (!parsed.ok || !entryDate || !selection.contractId) return;

			const entryData: CreateTimeEntryInput = {
				date: entryDate,
				durationMinutes: parsed.durationMinutes,
				contractId: selection.contractId,
				deliverableId: cascadeIdForSave(selection.deliverableId) || null,
				workTypeId: cascadeIdForSave(selection.workTypeId) || null,
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

	/** Escape or the backdrop: close a clean form, ask before losing a dirty one */
	async function requestClose() {
		if (!isDirty) {
			onClose();
			return;
		}
		isConfirmingClose = true;
		await tick();
		keepEditingButton?.focus();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) requestClose();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		// A focused select may have its own list open: Escape belongs to it, never to the modal
		if (event.target instanceof HTMLSelectElement) return;
		event.preventDefault();
		if (isConfirmingClose) {
			isConfirmingClose = false;
			return;
		}
		requestClose();
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
	class="fixed inset-x-0 z-50 flex touch-none justify-center bg-chalk-950/40 md:items-center md:p-4"
	style={viewportBox.style}
	onclick={handleBackdropClick}
	role="presentation"
	data-testid="add-entry-backdrop"
>
	<div
		class="flex h-full w-full flex-col bg-surface shadow-xl md:h-auto md:max-h-full md:max-w-md md:rounded-panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="add-entry-title"
	>
		<div
			class="min-h-0 flex-1 scroll-pt-2 scroll-pb-4 touch-pan-y overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 md:px-6 md:pt-6"
			onfocusin={revealFocusedField}
		>
			<h2 id="add-entry-title" class="mb-4 text-lg font-semibold text-ink">Add Time Entry</h2>

			<div class="space-y-3">
				<div>
					<label for="entry-date" class="block text-xs font-medium text-ink-muted">Date</label>
					<input
						id="entry-date"
						type="date"
						bind:value={entryDate}
						class="mt-0.5 block w-full rounded-control input-base px-2 py-1.5 text-sm"
					/>
					{#if dateError}<p class="mt-1 text-xs text-rust-600" role="alert">{dateError}</p>{/if}
				</div>

				<div>
					<label for="entry-description" class="block text-xs font-medium text-ink-muted">Description</label>
					<textarea
						id="entry-description"
						bind:this={descriptionElement}
						bind:value={description}
						onkeydown={handleFieldKeydown}
						rows="2"
						class="mt-0.5 block w-full rounded-control input-base px-2 py-1.5 text-sm"
						placeholder="What did you work on?"
					></textarea>
				</div>

				<CascadeFields
					{cascade}
					ids={{ contract: 'entry-contract', deliverable: 'deliverable-select', workType: 'work-type-select' }}
					{contractError}
					size="regular"
				/>

				<div>
					<label for="entry-duration" class="block text-xs font-medium text-ink-muted">Time</label>
					<div class="mt-0.5">
						<DurationField id="entry-duration" bind:value={durationText} errorMessage={durationError} onkeydown={handleFieldKeydown} />
					</div>
				</div>
			</div>

			{#if saveError}
				<div class="mt-3 rounded-control bg-rust-50 p-2 text-xs text-rust-600" role="alert">{saveError}</div>
			{/if}
		</div>

		<div
			class="flex shrink-0 items-center justify-end gap-2 border-t border-divider px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-4"
			data-testid="add-entry-actions"
		>
			{#if isConfirmingClose}
				<p class="mr-auto text-sm text-ink-soft" role="alert" data-testid="add-entry-confirm-close">Discard what you typed?</p>
				<button
					type="button"
					bind:this={keepEditingButton}
					onclick={() => (isConfirmingClose = false)}
					class="min-h-9 rounded-control btn-secondary px-3 py-1.5 text-sm"
				>
					Keep editing
				</button>
				<button type="button" onclick={onClose} class="min-h-9 rounded-control btn-danger px-3 py-1.5 text-sm font-medium">
					Close without saving
				</button>
			{:else}
				<button
					type="button"
					onclick={onClose}
					class="min-h-9 flex-1 rounded-control btn-secondary px-3 py-1.5 text-sm md:flex-none"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSave}
					disabled={isSaving}
					class="min-h-9 flex-1 rounded-control btn-primary px-4 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-70 md:flex-none"
				>
					{isSaving ? 'Saving…' : saveError ? 'Retry' : 'Save'}
				</button>
			{/if}
		</div>
	</div>
</div>
