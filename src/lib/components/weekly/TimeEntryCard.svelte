<script lang="ts">
	import { tick, untrack } from 'svelte';
	import {
		parseDuration,
		formatMinutes,
		formatTimeRange,
		formatDurationInput
	} from '$lib/utils/duration';
	import { getDataService } from '$lib/services/context';
	import { getClientBorderClass, getClientDotClass } from '$lib/utils/client-colors';
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';
	import DeliverableSelect from '$lib/components/timer/DeliverableSelect.svelte';
	import WorkTypeSelect from '$lib/components/timer/WorkTypeSelect.svelte';
	import DurationField from '$lib/components/timer/DurationField.svelte';
	import { formatContractLabel } from '$lib/components/timer/contract-label';
	import { contractHasDeliverables } from '$lib/components/timer/deliverable-cache';
	import { describeSaveError } from '$lib/components/timer/save-error';
	import WikiLinkRenderer from './WikiLinkRenderer.svelte';
	import WikiLinkInput from './WikiLinkInput.svelte';
	import { splitFormerlyLines } from './formerly-lines';
	import type { TimeEntryFields } from '$lib/services/types';

	const dataService = getDataService();

	type EntryData = {
		id: string;
		startTime: string | null;
		endTime: string | null;
		durationMinutes: number;
		contractId: string;
		contractName: string;
		clientName: string;
		clientShortCode: string;
		clientColorIndex: number;
		deliverableId?: string | null;
		deliverableName: string | null;
		workTypeId?: string | null;
		workTypeName: string | null;
		description: string | null;
		date: string;
	};

	let {
		entry,
		onUpdated,
		onNoteLinkClick
	}: {
		entry: EntryData;
		onUpdated?: () => void;
		onNoteLinkClick?: (noteId: string) => void;
	} = $props();

	// Inline editing states. Every editor: Enter saves, Escape cancels.
	let isEditingTime = $state(false);
	let isEditingContract = $state(false);
	let isEditingDeliverable = $state(false);
	let isEditingDescription = $state(false);
	let isConfirmingDelete = $state(false);
	let isDeleting = $state(false);

	// Editable values
	let timeInputValue = $state('');
	let timeInputError = $state('');
	let selectedContractId = $state('');
	let selectedDeliverableId = $state('');
	let selectedWorkTypeId = $state('');
	let descriptionInputValue = $state('');
	// Set by Escape so the blur that follows the editor closing does not save
	let isDescriptionCancelled = false;
	let isTimeCancelled = false;

	// A failed save or delete, shown on the card until the next attempt
	let cardError = $state('');

	// Long descriptions are clamped to three lines with a toggle
	let descriptionElement: HTMLElement | undefined = $state();
	let isDescriptionExpanded = $state(false);
	let isDescriptionOverflowing = $state(false);

	// Whether the contract has deliverables; decides if "Add deliverable…" is always shown
	let contractOffersDeliverables = $state(false);

	// After a contract change cleared the deliverable chain: the pickers open on the new
	// contract, set to none, with a one-line notice of what was cleared
	let contractChangeNotice = $state('');
	let deliverablePickerContractId = $state('');

	// Controls that take focus back when an editor is closed from the keyboard (A-11)
	let cardElement: HTMLElement | undefined = $state();
	let descriptionButton: HTMLButtonElement | undefined = $state();
	let contractButton: HTMLButtonElement | undefined = $state();
	let deliverableButton: HTMLButtonElement | undefined = $state();
	let timeButton: HTMLButtonElement | undefined = $state();
	let deliverableEditorElement: HTMLElement | undefined = $state();

	let clientBorderClass = $derived(getClientBorderClass(entry.clientColorIndex));
	let clientDotClass = $derived(getClientDotClass(entry.clientColorIndex));
	let durationDisplay = $derived(formatMinutes(entry.durationMinutes));
	let timeRangeDisplay = $derived(formatTimeRange(entry.startTime, entry.endTime));
	let contractLabel = $derived(formatContractLabel(entry.clientName, entry.contractName));
	let hasDeliverableOrWorkType = $derived(Boolean(entry.deliverableName || entry.workTypeName));
	let deliverableWorkTypeLabel = $derived(
		[entry.deliverableName, entry.workTypeName].filter(Boolean).join(' > ')
	);
	// "Formerly: …" lines (kept when a contract, deliverable or work type is deleted) get their own muted line
	let splitDescription = $derived(splitFormerlyLines(entry.description));

	/** Put focus back on a card control once the editor that replaced it is gone */
	async function refocus(getTarget: () => HTMLElement | undefined) {
		await tick();
		(getTarget() ?? cardElement)?.focus();
	}

	$effect(() => {
		const contractId = entry.contractId;
		contractHasDeliverables(dataService, contractId).then((hasDeliverables) => {
			if (contractId === entry.contractId) contractOffersDeliverables = hasDeliverables;
		});
	});

	// Re-measure when the text, the element or the card width changes
	$effect(() => {
		void entry.description;
		const measuredElement = descriptionElement;
		if (!measuredElement || isDescriptionExpanded) return;
		const measure = () => {
			isDescriptionOverflowing = measuredElement.scrollHeight > measuredElement.clientHeight + 1;
		};
		tick().then(measure);
		const resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(measuredElement);
		return () => resizeObserver.disconnect();
	});

	async function saveFields(data: Partial<TimeEntryFields>): Promise<boolean> {
		cardError = '';
		try {
			await dataService.updateTimeEntry(entry.id, data);
			onUpdated?.();
			return true;
		} catch (error) {
			cardError = describeSaveError(error);
			return false;
		}
	}

	// --- Time ---
	function startEditingTime() {
		timeInputValue = formatDurationInput(entry.durationMinutes, entry.startTime, entry.endTime);
		timeInputError = '';
		isTimeCancelled = false;
		isEditingTime = true;
	}

	async function saveTimeInput() {
		const parsed = parseDuration(timeInputValue);
		if (!parsed.ok) {
			timeInputError = parsed.error;
			return;
		}
		isEditingTime = false;
		timeInputError = '';
		const unchanged =
			formatDurationInput(entry.durationMinutes, entry.startTime, entry.endTime) === timeInputValue.trim();
		if (unchanged) return;
		await saveFields(
			parsed.kind === 'range'
				? { startTime: parsed.startTime, endTime: parsed.endTime, durationMinutes: parsed.durationMinutes }
				: { startTime: null, endTime: null, durationMinutes: parsed.durationMinutes }
		);
	}

	function cancelTimeEdit() {
		isTimeCancelled = true;
		isEditingTime = false;
		timeInputError = '';
	}

	function handleTimeKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveTimeInput().then(() => {
				if (!isEditingTime) refocus(() => timeButton);
			});
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelTimeEdit();
			refocus(() => timeButton);
		}
	}

	function handleTimeBlur() {
		if (isTimeCancelled || !isEditingTime) return;
		// Leaving the field saves a valid value; an invalid one stays open with its message
		saveTimeInput();
	}

	// --- Contract ---
	function startEditingContract() {
		selectedContractId = entry.contractId;
		isEditingContract = true;
	}

	function closeContractEditor() {
		isEditingContract = false;
	}

	$effect(() => {
		if (!isEditingContract || !selectedContractId || selectedContractId === entry.contractId) return;
		const nextContractId = selectedContractId;
		untrack(() => changeContract(nextContractId));
	});

	/**
	 * A deliverable and work type belong to a contract, so a contract change always clears both
	 * (the server does not do it for us). When there was something to clear, the deliverable
	 * pickers open on the new contract set to none, with a notice saying what went.
	 */
	function changeContract(nextContractId: string) {
		const hadDeliverableChain = Boolean(entry.deliverableId || entry.workTypeId);
		const clearedLabel = deliverableWorkTypeLabel || 'Deliverable';
		const previousContractLabel = contractLabel;
		isEditingContract = false;
		saveFields({ contractId: nextContractId, deliverableId: null, workTypeId: null });
		if (!hadDeliverableChain) {
			contractChangeNotice = '';
			refocus(() => contractButton);
			return;
		}
		selectedDeliverableId = '';
		selectedWorkTypeId = '';
		deliverablePickerContractId = nextContractId;
		contractChangeNotice = `Cleared “${clearedLabel}”: it belongs to ${previousContractLabel}.`;
		isEditingDeliverable = true;
		refocus(() => deliverableEditorElement?.querySelector('select') ?? undefined);
	}

	function handleContractKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || event.key === 'Enter') {
			event.preventDefault();
			closeContractEditor();
			refocus(() => contractButton);
		}
	}

	// --- Deliverable / work type: each pick is saved immediately; Done, Enter or Escape closes ---
	function startEditingDeliverable() {
		selectedDeliverableId = entry.deliverableId ?? '';
		selectedWorkTypeId = entry.workTypeId ?? '';
		deliverablePickerContractId = '';
		contractChangeNotice = '';
		isEditingDeliverable = true;
	}

	function closeDeliverableEditor(returnFocus: boolean) {
		isEditingDeliverable = false;
		contractChangeNotice = '';
		deliverablePickerContractId = '';
		if (returnFocus) refocus(() => deliverableButton);
	}

	function handleDeliverableChange(nextDeliverableId: string) {
		// Work types belong to a deliverable, so changing the deliverable clears the work type
		selectedWorkTypeId = '';
		saveFields({ deliverableId: nextDeliverableId || null, workTypeId: null });
	}

	function handleWorkTypeChange(nextWorkTypeId: string) {
		saveFields({ deliverableId: selectedDeliverableId || null, workTypeId: nextWorkTypeId || null });
	}

	function handleDeliverableKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || event.key === 'Enter') {
			event.preventDefault();
			closeDeliverableEditor(true);
		}
	}

	// --- Description ---
	function startEditingDescription() {
		descriptionInputValue = entry.description ?? '';
		isDescriptionCancelled = false;
		isEditingDescription = true;
	}

	function handleDescriptionInputValue(newValue: string) {
		descriptionInputValue = newValue;
	}

	function commitDescription() {
		if (isDescriptionCancelled || !isEditingDescription) return;
		isEditingDescription = false;
		if (descriptionInputValue !== (entry.description ?? '')) {
			saveFields({ description: descriptionInputValue });
		}
	}

	function handleDescriptionKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitDescription();
			refocus(() => descriptionButton);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			isDescriptionCancelled = true;
			isEditingDescription = false;
			refocus(() => descriptionButton);
		}
	}

	// --- Delete ---
	async function handleDelete() {
		isDeleting = true;
		cardError = '';
		try {
			await dataService.deleteTimeEntry(entry.id);
			onUpdated?.();
		} catch (error) {
			cardError = describeSaveError(error).replace("Couldn't save", "Couldn't delete");
		} finally {
			isDeleting = false;
			isConfirmingDelete = false;
		}
	}
</script>

<!-- Focusable (not in the Tab order) so a save can hand focus to the card it saved -->
<div
	bind:this={cardElement}
	tabindex="-1"
	role="group"
	aria-label="{splitDescription.body || 'Time entry'}, {contractLabel}, {durationDisplay}"
	class="group relative mb-2 flex rounded-lg border border-stone-200 border-l-[3px] bg-white p-3 transition-colors hover:bg-stone-50/50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none {clientBorderClass}"
	data-testid="time-entry-card"
	data-entry-id={entry.id}
>
	<!-- Delete: on hover, on keyboard focus and always on touch screens -->
	<div class="absolute right-1.5 top-1.5">
		{#if isConfirmingDelete}
			<div class="flex items-center gap-1 rounded bg-white">
				<span class="text-xs text-stone-500">Delete?</span>
				<button
					onclick={handleDelete}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
				>{isDeleting ? '…' : 'Yes'}</button>
				<button
					onclick={() => (isConfirmingDelete = false)}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-50"
				>No</button>
			</div>
		{:else}
			<button
				onclick={() => (isConfirmingDelete = true)}
				class="flex h-6 w-6 items-center justify-center rounded text-stone-400 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 pointer-coarse:h-8 pointer-coarse:w-8 pointer-coarse:opacity-100"
				title="Delete entry"
				aria-label="Delete entry"
			>&times;</button>
		{/if}
	</div>

	<!-- Left content column -->
	<div class="min-w-0 flex-1">
		<!-- Row 1: Description (hero text) -->
		{#if isEditingDescription}
			<WikiLinkInput
				bind:value={descriptionInputValue}
				placeholder="What did you work on? (type [[ to link a note)"
				onInput={handleDescriptionInputValue}
				onBlur={commitDescription}
				onKeydown={handleDescriptionKeydown}
				autofocus
			/>
		{:else}
			<button
				bind:this={descriptionButton}
				onclick={startEditingDescription}
				class="block w-full text-left text-sm font-medium text-stone-900 hover:text-blue-600"
				title="Click to edit description"
			>
				{#if splitDescription.body}
					<span
						bind:this={descriptionElement}
						class="break-words whitespace-pre-line {isDescriptionExpanded ? 'block' : 'line-clamp-3'}"
					>
						<WikiLinkRenderer text={splitDescription.body} {onNoteLinkClick} />
					</span>
				{:else}
					<span class="italic text-stone-400">What did you work on?</span>
				{/if}
			</button>
			{#if isDescriptionOverflowing || isDescriptionExpanded}
				<button
					type="button"
					onclick={() => (isDescriptionExpanded = !isDescriptionExpanded)}
					class="mt-0.5 text-xs text-blue-600 hover:text-blue-800"
					aria-expanded={isDescriptionExpanded}
				>{isDescriptionExpanded ? 'Show less' : 'Show more'}</button>
			{/if}
			{#each splitDescription.formerlyLines as formerlyLine, lineIndex (lineIndex)}
				<p class="mt-0.5 text-xs break-words text-stone-400" data-testid="formerly-line">{formerlyLine}</p>
			{/each}
		{/if}

		<!-- Row 2: Client / Contract with colour dot -->
		<div class="mt-1">
			{#if isEditingContract}
				<div
					class="max-w-xs"
					onfocusout={(event) => {
						if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
							closeContractEditor();
						}
					}}
				>
					<ContractSelect
						bind:selectedContractId
						compact={true}
						autofocus={true}
						onkeydown={handleContractKeydown}
					/>
				</div>
			{:else}
				<button
					bind:this={contractButton}
					onclick={startEditingContract}
					class="flex items-center gap-1.5 text-left text-xs text-stone-500 hover:text-blue-600"
					title="Click to change contract"
				>
					<span class="inline-block h-2 w-2 shrink-0 rounded-full {clientDotClass}"></span>
					{contractLabel}
				</button>
			{/if}
		</div>

		<!-- Row 3: Deliverable > Work Type -->
		<div class="mt-0.5 pl-3.5">
			{#if isEditingDeliverable}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={deliverableEditorElement}
					class="flex max-w-md items-center gap-1.5"
					onkeydown={handleDeliverableKeydown}
				>
					<DeliverableSelect
						contractId={deliverablePickerContractId || entry.contractId}
						bind:selectedDeliverableId
						compact={true}
						alwaysRender={true}
						onChange={handleDeliverableChange}
					/>
					<WorkTypeSelect
						deliverableId={selectedDeliverableId}
						bind:selectedWorkTypeId
						compact={true}
						onChange={handleWorkTypeChange}
					/>
					<button
						onclick={() => closeDeliverableEditor(true)}
						class="shrink-0 rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100"
						type="button"
					>Done</button>
				</div>
				{#if contractChangeNotice}
					<p class="mt-1 text-xs text-amber-700" role="status" data-testid="contract-change-notice">
						{contractChangeNotice}
					</p>
				{/if}
			{:else if hasDeliverableOrWorkType}
				<button
					bind:this={deliverableButton}
					onclick={startEditingDeliverable}
					class="block text-left text-xs text-stone-400 hover:text-blue-600"
					title="Click to change deliverable / work type"
				>{deliverableWorkTypeLabel}</button>
			{:else}
				<!-- Prompt only where it is useful: the contract has deliverables, or on hover/focus -->
				<button
					bind:this={deliverableButton}
					onclick={startEditingDeliverable}
					class="block text-left text-xs italic text-stone-400 hover:text-blue-600 {contractOffersDeliverables
						? ''
						: 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'}"
					title="Click to add a deliverable"
				>Add deliverable…</button>
			{/if}
		</div>

		{#if cardError}
			<p class="mt-1 text-xs text-red-600" role="alert">{cardError}</p>
		{/if}
	</div>

	<!-- Right column: Duration + time range -->
	<!-- mr leaves room for the delete button in the top-right corner -->
	<div class="mr-6 ml-2 flex shrink-0 flex-col items-end justify-center pointer-coarse:mr-8">
		{#if isEditingTime}
			<div class="w-36">
				<DurationField
					bind:value={timeInputValue}
					errorMessage={timeInputError}
					compact={true}
					align="right"
					autofocus={true}
					onkeydown={handleTimeKeydown}
					onblur={handleTimeBlur}
				/>
			</div>
		{:else}
			<button
				bind:this={timeButton}
				onclick={startEditingTime}
				class="text-right text-sm font-medium tabular-nums text-stone-500 hover:text-blue-600"
				title="Click to edit time"
			>
				{durationDisplay}
			</button>
			{#if timeRangeDisplay}
				<div class="mt-0.5 text-xs tabular-nums text-stone-400">{timeRangeDisplay}</div>
			{/if}
		{/if}
	</div>
</div>
