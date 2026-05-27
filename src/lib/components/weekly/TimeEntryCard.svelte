<script lang="ts">
	import { formatTimeShort, formatDuration } from '$lib/utils/iso-week';
	import { parseTimeInput } from '$lib/utils/time-parse';
	import { getDataService } from '$lib/services/context';
	import { getClientBorderClass, getClientDotClass } from '$lib/utils/client-colors';
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';
	import WikiLinkRenderer from './WikiLinkRenderer.svelte';
	import WikiLinkInput from './WikiLinkInput.svelte';
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
		deliverableName: string | null;
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

	// Inline editing states
	let isEditingTime = $state(false);
	let isEditingContract = $state(false);
	let isEditingDescription = $state(false);
	let isConfirmingDelete = $state(false);
	let isDeleting = $state(false);

	// Editable values
	let timeInputValue = $state('');
	let timeInputError = $state(false);
	let selectedContractId = $state('');
	let descriptionInputValue = $state('');
	let descriptionDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Derived style classes
	let clientBorderClass = $derived(getClientBorderClass(entry.clientColorIndex));
	let clientDotClass = $derived(getClientDotClass(entry.clientColorIndex));

	let hasTimeRange = $derived(Boolean(entry.startTime && entry.endTime));
	let durationDisplay = $derived(formatDuration(entry.durationMinutes));
	let timeRangeDisplay = $derived(
		hasTimeRange ? `${formatTimeShort(entry.startTime!)}-${formatTimeShort(entry.endTime!)}` : null
	);
	let hasDeliverableOrWorkType = $derived(Boolean(entry.deliverableName || entry.workTypeName));
	let deliverableWorkTypeLabel = $derived(
		[entry.deliverableName, entry.workTypeName].filter(Boolean).join(' > ')
	);

	async function saveField(field: string, value: unknown) {
		try {
			await dataService.updateTimeEntry(entry.id, { [field]: value } as Partial<TimeEntryFields>);
			onUpdated?.();
		} catch (error) {
			console.error(`Error saving ${field}:`, error);
		}
	}

	async function saveMultipleFields(data: Record<string, unknown>) {
		try {
			await dataService.updateTimeEntry(entry.id, data as Partial<TimeEntryFields>);
			onUpdated?.();
		} catch (error) {
			console.error('Error saving entry:', error);
		}
	}

	// Time editing
	function startEditingTime() {
		timeInputValue = hasTimeRange
			? `${formatTimeShort(entry.startTime!)}-${formatTimeShort(entry.endTime!)}`
			: formatDuration(entry.durationMinutes);
		timeInputError = false;
		isEditingTime = true;
	}

	function saveTimeInput() {
		const parsed = parseTimeInput(timeInputValue);
		if (parsed.type === 'invalid') {
			timeInputError = true;
			return;
		}
		if (parsed.type === 'range') {
			saveMultipleFields({
				startTime: parsed.startTime,
				endTime: parsed.endTime,
				durationMinutes: parsed.durationMinutes
			});
		} else {
			saveMultipleFields({
				startTime: null,
				endTime: null,
				durationMinutes: parsed.durationMinutes
			});
		}
		isEditingTime = false;
		timeInputError = false;
	}

	function cancelTimeEdit() {
		isEditingTime = false;
		timeInputError = false;
	}

	function handleTimeKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') saveTimeInput();
		else if (event.key === 'Escape') cancelTimeEdit();
	}

	function handleTimeBlur() {
		saveTimeInput();
	}

	// Contract editing
	function startEditingContract() {
		selectedContractId = entry.contractId;
		isEditingContract = true;
	}

	$effect(() => {
		if (isEditingContract && selectedContractId && selectedContractId !== entry.contractId) {
			saveField('contractId', selectedContractId);
			isEditingContract = false;
		}
	});

	// Description editing
	function startEditingDescription() {
		descriptionInputValue = entry.description ?? '';
		isEditingDescription = true;
	}

	function handleDescriptionInputValue(newValue: string) {
		descriptionInputValue = newValue;
		clearTimeout(descriptionDebounceTimer);
		descriptionDebounceTimer = setTimeout(() => {
			saveField('description', descriptionInputValue);
		}, 1000);
	}

	function handleDescriptionBlur() {
		clearTimeout(descriptionDebounceTimer);
		if (descriptionInputValue !== (entry.description ?? '')) {
			saveField('description', descriptionInputValue);
		}
		isEditingDescription = false;
	}

	function handleDescriptionKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
		else if (event.key === 'Escape') isEditingDescription = false;
	}

	// Delete
	async function handleDelete() {
		isDeleting = true;
		try {
			await dataService.deleteTimeEntry(entry.id);
			onUpdated?.();
		} catch (error) {
			console.error('Error deleting entry:', error);
		} finally {
			isDeleting = false;
			isConfirmingDelete = false;
		}
	}
</script>

<div
	class="group relative mb-2 flex rounded-lg border border-stone-200 border-l-[3px] bg-white p-3 transition-colors hover:bg-stone-50/50 {clientBorderClass}"
>
	<!-- Delete button: top-right corner, visible on hover -->
	<div class="absolute right-1.5 top-1.5">
		{#if isConfirmingDelete}
			<div class="flex items-center gap-1">
				<button
					onclick={handleDelete}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
				>{isDeleting ? '...' : 'Yes'}</button>
				<button
					onclick={() => (isConfirmingDelete = false)}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-50"
				>No</button>
			</div>
		{:else}
			<button
				onclick={() => (isConfirmingDelete = true)}
				class="rounded px-1 py-0.5 text-stone-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
				title="Delete entry"
			>&times;</button>
		{/if}
	</div>

	<!-- Left content column -->
	<div class="min-w-0 flex-1">
		<!-- Row 1: Description (hero text) -->
		{#if isEditingDescription}
			<WikiLinkInput
				bind:value={descriptionInputValue}
				placeholder="Add description... (type [[ to link a note)"
				onInput={handleDescriptionInputValue}
				onBlur={handleDescriptionBlur}
				onKeydown={handleDescriptionKeydown}
				autofocus
			/>
		{:else}
			<button
				onclick={startEditingDescription}
				class="block w-full text-left text-sm font-medium text-stone-900 hover:text-blue-600"
				title="Click to edit description"
			>
				{#if entry.description}
					<WikiLinkRenderer text={entry.description} {onNoteLinkClick} />
				{:else}
					<span class="italic text-stone-400">Add description...</span>
				{/if}
			</button>
		{/if}

		<!-- Row 2: Client / Contract with color dot -->
		<div class="mt-1">
			{#if isEditingContract}
				<div class="max-w-xs">
					<ContractSelect bind:selectedContractId compact={true} />
				</div>
			{:else}
				<button
					onclick={startEditingContract}
					class="flex items-center gap-1.5 text-left text-xs text-stone-500 hover:text-blue-600"
					title="Click to change contract"
				>
					<span class="inline-block h-2 w-2 shrink-0 rounded-full {clientDotClass}"></span>
					{entry.clientName} / {entry.contractName}
				</button>
			{/if}
		</div>

		<!-- Row 3 (optional): Deliverable > Work Type -->
		{#if hasDeliverableOrWorkType}
			<div class="mt-0.5 pl-3.5 text-xs text-stone-400">
				{deliverableWorkTypeLabel}
			</div>
		{/if}
	</div>

	<!-- Right column: Duration + time range -->
	<div class="ml-4 flex shrink-0 flex-col items-end justify-center">
		{#if isEditingTime}
			<input
				type="text"
				bind:value={timeInputValue}
				onblur={handleTimeBlur}
				onkeydown={handleTimeKeydown}
				class="w-24 rounded border px-1.5 py-0.5 text-right text-sm font-medium tabular-nums focus:ring-1 focus:outline-none {timeInputError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-stone-300 focus:border-blue-500 focus:ring-blue-500'}"
				placeholder="2h30m"
				autofocus
			/>
		{:else}
			<button
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
