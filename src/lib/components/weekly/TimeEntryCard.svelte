<script lang="ts">
	import { tick, untrack } from 'svelte';
	import {
		parseDuration,
		formatMinutes,
		formatTimeRange,
		formatDurationInput
	} from '$lib/utils/duration';
	import { getDataService } from '$lib/services/context';
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';
	import DurationField from '$lib/components/timer/DurationField.svelte';
	import { formatContractLabel } from '$lib/components/timer/contract-label';
	import { contractHasDeliverables } from '$lib/components/timer/deliverable-cache';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { deliverableHasWorkTypes } from './work-type-options';
	import { missingDetailAction, missingDetailFor } from './missing-detail';
	import { describeSaveError } from '$lib/components/timer/save-error';
	import WikiLinkRenderer from './WikiLinkRenderer.svelte';
	import OutboxMarker from '$lib/offline/OutboxMarker.svelte';
	import WikiLinkInput from './WikiLinkInput.svelte';
	import AttachNoteButton from './AttachNoteButton.svelte';
	import EntryClassificationEditor from './EntryClassificationEditor.svelte';
	import { attachNewNoteToEntry, attachNoteBlockedReason } from './attach-note';
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
		/** The offline outbox's temp ID it was created with, if any (sprint 045-CL) */
		clientRequestId?: string | null;
		description: string | null;
		date: string;
	};

	let {
		entry,
		onUpdated,
		onNoteLinkClick,
		onNoteAttached
	}: {
		entry: EntryData;
		onUpdated?: () => void;
		onNoteLinkClick?: (noteId: string) => void;
		/** A note was made and linked by Attach note: open it, ready to type */
		onNoteAttached?: (noteId: string) => void;
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

	// Whether the contract has deliverables / the deliverable has work types: decides the local
	// missing-detail cue (TR-05), shown whenever there are options and the field is empty
	let contractOffersDeliverables = $state(false);
	let deliverableOffersWorkTypes = $state(false);
	// Reopen an editor after a failed save without pulling focus from where the user went
	let focusReopenedEditor = $state(true);

	// After a contract change cleared the deliverable chain: the pickers open on the new
	// contract, set to none, with a one-line notice of what was cleared
	let contractChangeNotice = $state('');
	let deliverablePickerContractId = $state('');
	// What the classification editor opens on (the entry's values, or none after a contract change)
	let editorDeliverableId = $state<string | null>(null);
	let editorWorkTypeId = $state<string | null>(null);

	// Controls that take focus back when an editor is closed from the keyboard (A-11)
	let cardElement: HTMLElement | undefined = $state();
	let descriptionButton: HTMLButtonElement | undefined = $state();
	let contractButton: HTMLButtonElement | undefined = $state();
	let deliverableButton: HTMLButtonElement | undefined = $state();
	let missingDetailButton: HTMLButtonElement | undefined = $state();
	let timeButton: HTMLButtonElement | undefined = $state();
	let deliverableEditorElement: HTMLElement | undefined = $state();

	let durationDisplay = $derived(formatMinutes(entry.durationMinutes));
	let timeRangeDisplay = $derived(formatTimeRange(entry.startTime, entry.endTime));
	let contractLabel = $derived(formatContractLabel(entry.clientName, entry.contractName));
	let hasDeliverableOrWorkType = $derived(Boolean(entry.deliverableName || entry.workTypeName));
	let missingDetail = $derived(
		missingDetailFor({
			contractHasDeliverables: contractOffersDeliverables,
			deliverableId: entry.deliverableId,
			deliverableHasWorkTypes: deliverableOffersWorkTypes,
			workTypeId: entry.workTypeId
		})
	);
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

	$effect(() => {
		const deliverableId = entry.deliverableId;
		if (!deliverableId) {
			deliverableOffersWorkTypes = false;
			return;
		}
		deliverableHasWorkTypes(dataService, deliverableId).then((hasWorkTypes) => {
			if (deliverableId === entry.deliverableId) deliverableOffersWorkTypes = hasWorkTypes;
		});
	});

	/** Is focus somewhere it can be taken from (lost to <body>, or still in this row)? */
	function focusIsFree(): boolean {
		const activeElement = document.activeElement;
		return !activeElement || activeElement === document.body || Boolean(cardElement?.contains(activeElement));
	}

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
		focusReopenedEditor = true;
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
		const saved = await saveFields(
			parsed.kind === 'range'
				? { startTime: parsed.startTime, endTime: parsed.endTime, durationMinutes: parsed.durationMinutes }
				: { startTime: null, endTime: null, durationMinutes: parsed.durationMinutes }
		);
		// A failed save keeps what was typed: the editor opens again with it and the error below
		if (!saved) {
			focusReopenedEditor = focusIsFree();
			isTimeCancelled = false;
			isEditingTime = true;
		}
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
		editorDeliverableId = null;
		editorWorkTypeId = null;
		deliverablePickerContractId = nextContractId;
		contractChangeNotice = `Cleared “${clearedLabel}”: it belongs to ${previousContractLabel}.`;
		isEditingDeliverable = true;
		// (the editor itself while its options are still loading)
		refocus(() => deliverableEditorElement?.querySelector<HTMLElement>('select:not(:disabled)') ?? deliverableEditorElement);
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
		editorDeliverableId = entry.deliverableId ?? null;
		editorWorkTypeId = entry.workTypeId ?? null;
		deliverablePickerContractId = '';
		contractChangeNotice = '';
		isEditingDeliverable = true;
		// Focus the picker so Escape / Enter (and a screen reader) are in the editor
		// (the editor itself while its options are still loading)
		refocus(() => deliverableEditorElement?.querySelector<HTMLElement>('select:not(:disabled)') ?? deliverableEditorElement);
	}

	function closeDeliverableEditor(returnFocus: boolean) {
		isEditingDeliverable = false;
		contractChangeNotice = '';
		deliverablePickerContractId = '';
		if (returnFocus) refocus(() => deliverableButton ?? missingDetailButton);
	}

	// (the picks themselves are saved by EntryClassificationEditor through saveFields)

	// --- Description ---
	function startEditingDescription() {
		focusReopenedEditor = true;
		descriptionInputValue = entry.description ?? '';
		isDescriptionCancelled = false;
		isEditingDescription = true;
	}

	function handleDescriptionInputValue(newValue: string) {
		descriptionInputValue = newValue;
	}

	async function commitDescription() {
		if (isDescriptionCancelled || !isEditingDescription) return;
		isEditingDescription = false;
		if (descriptionInputValue === (entry.description ?? '')) return;
		const typedValue = descriptionInputValue;
		const saved = await saveFields({ description: typedValue });
		// A failed save keeps what was typed: the editor opens again with it and the error below
		if (!saved && !isEditingDescription) {
			focusReopenedEditor = focusIsFree();
			descriptionInputValue = typedValue;
			isDescriptionCancelled = false;
			isEditingDescription = true;
		}
	}

	function handleDescriptionKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitDescription();
			refocus(() => descriptionButton);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			isDescriptionCancelled = true;
			isEditingDescription = false;
			refocus(() => descriptionButton);
		}
	}

	// --- Attach note (049-UI): new note on the entry's contract, linked at the end of the description ---
	async function attachNewNote() {
		// An open description editor: its text is what gets the link; its pending blur must not save
		const baseDescription = isEditingDescription ? descriptionInputValue : entry.description;
		if (isEditingDescription) {
			isDescriptionCancelled = true;
			isEditingDescription = false;
		}
		cardError = '';
		try {
			const { noteId } = await attachNewNoteToEntry(dataService, {
				entryId: entry.id,
				contractId: entry.contractId,
				description: baseDescription
			});
			onUpdated?.();
			onNoteAttached?.(noteId);
		} catch (error) {
			cardError = describeSaveError(error).replace("Couldn't save", "Couldn't attach a note");
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

<!--
	One entry row of the time review (design r1 TR-03..TR-06, sprint 057-DR). A grid: identity
	(ContractMark + contract name, client smaller beneath), description with its classification
	beneath, duration and time range on the right, then the row actions. Narrow (the panel, not the
	viewport, via a container query): identity and time on the first line, description and
	classification full width beneath. Separators run from the contract name's left edge to the right
	edge (`--spacing-entry-rule-start`), so rows of one contract line up; open at the left.
	Editing keeps the row's footprint: the classification line and the time column reserve their
	editor heights, the time preview / error line is positioned in reserved space, and the
	description editor grows to its text.
-->
<!-- Focusable (not in the Tab order) so a save can hand focus to the card it saved -->
<div
	bind:this={cardElement}
	tabindex="-1"
	role="group"
	aria-label="{splitDescription.body || 'Time entry'}, {contractLabel}, {durationDisplay}"
	class="entry-row group relative py-2.5 pl-3 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
	data-testid="time-entry-card"
	data-entry-id={entry.id}
>
	<!-- Identity: mark + contract name, client beneath (DS-02 / DS-04: compact mark, readable context) -->
	<div class="entry-identity flex min-w-0 items-start gap-mark-gap">
		<span class="mt-0.5"><ContractMark contractName={entry.contractName} colorIndex={entry.clientColorIndex} size="sm" /></span>
		{#if isEditingContract}
			<div
				class="entry-compact-select min-w-0 flex-1"
				onfocusout={(event) => {
					if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
						closeContractEditor();
					}
				}}
			>
				<ContractSelect bind:selectedContractId compact={true} autofocus={true} onkeydown={handleContractKeydown} />
			</div>
		{:else}
			<button
				bind:this={contractButton}
				onclick={startEditingContract}
				class="entry-field min-w-0 text-left"
				title="Click to change contract"
				aria-label="Contract: {contractLabel}. Change contract"
			>
				<span class="block text-sm leading-5 font-semibold break-words text-ink" data-testid="entry-contract-name">{entry.contractName}</span>
				<span class="block text-xs leading-4 break-words text-ink-faint" data-testid="entry-client-name">{entry.clientName}</span>
			</button>
		{/if}
	</div>

	<!-- Description, with "Formerly" lines and the classification beneath -->
	<div class="entry-body min-w-0">
		{#if isEditingDescription}
			<WikiLinkInput
				bind:value={descriptionInputValue}
				multiline
				ariaLabel="Description"
				fieldClass="entry-description-editor text-sm leading-5 font-medium text-ink"
				placeholder="What did you work on? (type [[ to link a note)"
				onInput={handleDescriptionInputValue}
				onBlur={commitDescription}
				onKeydown={handleDescriptionKeydown}
				autofocus={focusReopenedEditor}
			/>
		{:else}
			<button
				bind:this={descriptionButton}
				onclick={startEditingDescription}
				class="entry-field block w-full text-left text-sm leading-5 font-medium text-ink"
				title="Click to edit description"
			>
				{#if splitDescription.body}
					<span bind:this={descriptionElement} class="break-words whitespace-pre-line {isDescriptionExpanded ? 'block' : 'line-clamp-3'}">
						<WikiLinkRenderer text={splitDescription.body} {onNoteLinkClick} />
					</span>
				{:else}
					<span class="italic text-ink-faint">What did you work on?</span>
				{/if}
			</button>
			{#if isDescriptionOverflowing || isDescriptionExpanded}
				<button
					type="button"
					onclick={() => (isDescriptionExpanded = !isDescriptionExpanded)}
					class="text-xs text-primary hover:text-primary-hover"
					aria-expanded={isDescriptionExpanded}
				>{isDescriptionExpanded ? 'Show less' : 'Show more'}</button>
			{/if}
			{#each splitDescription.formerlyLines as formerlyLine, lineIndex (lineIndex)}
				<p class="text-xs break-words text-ink-faint" data-testid="formerly-line">{formerlyLine}</p>
			{/each}
		{/if}

		<!-- Classification: deliverable › work type, or the local missing-detail cue (TR-05) -->
		{#if isEditingDeliverable || hasDeliverableOrWorkType || missingDetail}
			<div class="entry-classification flex min-h-6 min-w-0 items-center gap-1.5">
				{#if isEditingDeliverable}
					<!-- Keyed by contract: a contract change while open starts a fresh cascade -->
					{#key deliverablePickerContractId || entry.contractId}
					<EntryClassificationEditor
						bind:element={deliverableEditorElement}
						contractId={deliverablePickerContractId || entry.contractId}
						deliverableId={editorDeliverableId}
						workTypeId={editorWorkTypeId}
						onSave={(fields) => saveFields(fields)}
						onDone={() => closeDeliverableEditor(true)}
					/>
					{/key}
				{:else}
					{#if hasDeliverableOrWorkType}
						<button
							bind:this={deliverableButton}
							onclick={startEditingDeliverable}
							class="entry-field min-w-0 text-left text-xs break-words text-ink-muted"
							title="Click to change deliverable / work type"
						>{deliverableWorkTypeLabel}</button>
					{/if}
					{#if missingDetail}
						<button
							bind:this={missingDetailButton}
							onclick={startEditingDeliverable}
							class="inline-flex shrink-0 items-center gap-1 rounded-control text-xs font-medium text-warning underline decoration-ochre-300 underline-offset-2 hover:decoration-ochre-600 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
							data-testid="missing-detail-cue"
							data-missing={missingDetail}
						>
							<span class="inline-flex size-3.5 items-center justify-center rounded-full bg-ochre-400 text-[9px] leading-none font-bold text-on-accent no-underline" aria-hidden="true">!</span>
							{missingDetailAction(missingDetail)}
						</button>
					{/if}
				{/if}
			</div>
			{#if contractChangeNotice}
				<!-- The notice takes the place of nothing: one truncated line, the full text on hover and for screen readers -->
				<p class="truncate text-xs text-warning" role="status" title={contractChangeNotice} data-testid="contract-change-notice">{contractChangeNotice}</p>
			{/if}
		{/if}

		{#if cardError}
			<p class="mt-0.5 text-xs text-danger" role="alert">{cardError}</p>
		{/if}
	</div>

	<!-- Duration and time range, right-aligned (a duration-only entry shows no invented range) -->
	<div class="entry-time flex min-h-10 flex-col items-end">
		{#if isEditingTime}
			<div class="entry-time-editor relative w-32">
				<DurationField
					bind:value={timeInputValue}
					errorMessage={timeInputError}
					compact={true}
					align="right"
					autofocus={focusReopenedEditor}
					onkeydown={handleTimeKeydown}
					onblur={handleTimeBlur}
				/>
			</div>
		{:else}
			<button
				bind:this={timeButton}
				onclick={startEditingTime}
				class="entry-field text-right text-sm leading-5 font-semibold tabular-nums text-ink"
				title="Click to edit time"
			>{durationDisplay}</button>
			{#if timeRangeDisplay}
				<div class="text-xs leading-4 tabular-nums text-ink-faint" data-testid="entry-time-range">{timeRangeDisplay}</div>
			{/if}
		{/if}
	</div>

	<!-- Row actions: Delete (hover, keyboard focus, always on touch), Attach note, outbox state -->
	<div class="entry-actions">
		{#if isConfirmingDelete}
			<div class="absolute top-1.5 right-1 z-10 flex items-center gap-1 rounded-control bg-surface px-1 shadow-menu">
				<span class="text-xs text-ink-faint">Delete?</span>
				<button
					onclick={handleDelete}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-danger hover:bg-danger-wash disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-3"
				>{isDeleting ? '…' : 'Yes'}</button>
				<button
					onclick={() => (isConfirmingDelete = false)}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-ink-faint hover:bg-sunken disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-3"
				>No</button>
			</div>
		{/if}
		<button
			onclick={() => (isConfirmingDelete = true)}
			class="flex h-6 w-6 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-danger-wash hover:text-danger focus-visible:opacity-100 pointer-coarse:h-8 pointer-coarse:w-8 pointer-coarse:opacity-100"
			title="Delete entry"
			aria-label="Delete entry"
		>&times;</button>
		<AttachNoteButton blockedReason={attachNoteBlockedReason(entry.contractId)} onAttach={attachNewNote} />
		<div class="pointer-events-none">
			<OutboxMarker resourceKey="entry:{entry.id}" otherKey={entry.clientRequestId ? `entry:${entry.clientRequestId}` : null} />
		</div>
	</div>
</div>

<style>
	/* Narrow panel (phone): identity and time on one line, description full width beneath */
	.entry-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		grid-template-areas:
			'identity time actions'
			'body body body';
		column-gap: 0.75rem;
		row-gap: 0.25rem;
		align-items: start;
	}
	.entry-identity {
		grid-area: identity;
	}
	.entry-body {
		grid-area: body;
	}
	.entry-time {
		grid-area: time;
	}
	.entry-actions {
		grid-area: actions;
		display: flex;
		flex-direction: row;
		align-items: flex-start;
	}
	/* Wide panel: one line of columns; the identity column is stable so same-contract rows align */
	@container (min-width: 36rem) {
		.entry-row {
			grid-template-columns: var(--size-entry-identity) minmax(0, 1fr) auto auto;
			grid-template-areas: 'identity body time actions';
			column-gap: 1rem;
		}
		.entry-actions {
			flex-direction: column;
			align-items: center;
		}
	}

	/* Separator: from the contract name's left edge to the right edge; open at the left (TR-04, O04) */
	.entry-row::after {
		content: '';
		position: absolute;
		left: var(--spacing-entry-rule-start);
		right: 0;
		bottom: 0;
		border-bottom: 1px solid var(--color-divider);
		pointer-events: none;
	}

	/* Field-level edit cue: subtle on hover / focus, works without hover on touch */
	.entry-field {
		border-radius: var(--radius-mark);
		transition: background-color 120ms;
	}
	.entry-field:hover {
		background-color: var(--color-sunken);
	}
	.entry-field:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 1px;
	}

	/* The editors keep the row's footprint: compact selects fit the reserved line */
	.entry-compact-select :global(select) {
		height: 1.5rem;
		padding-block: 0;
		line-height: 1.25rem;
	}
	.entry-time-editor :global(input) {
		height: 1.5rem;
		padding-block: 0;
	}
	/* Preview / warning / error line: in the time column's reserved space, never pushing the row */
	.entry-time-editor :global(p) {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0;
		width: max-content;
		max-width: 16rem;
		text-align: right;
		line-height: 1rem;
		background-color: var(--color-surface);
		z-index: 1;
	}
	:global(.entry-description-editor) {
		box-shadow: 0 0 0 1px var(--color-focus);
		border-radius: var(--radius-mark);
	}
</style>
