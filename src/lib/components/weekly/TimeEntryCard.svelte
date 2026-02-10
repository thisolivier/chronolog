<script lang="ts">
	import { formatTimeShort, formatDuration } from '$lib/utils/iso-week';
	import { parseTimeInput } from '$lib/utils/time-parse';
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';
	import { getDataService } from '$lib/sync/context';
	import type { TimeEntryDisplay } from '$lib/sync/data-types';

	let {
		entry,
		onUpdated
	}: {
		entry: TimeEntryDisplay;
		onUpdated?: () => void;
	} = $props();

	const dataService = getDataService();

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

	function buildContextLabel(): string {
		const parts = [entry.clientName, entry.contractName];
		if (entry.deliverableName) parts.push(entry.deliverableName);
		if (entry.workTypeName) parts.push(entry.workTypeName);
		return parts.join(' / ');
	}

	/** Build the display string for the time area */
	function buildTimeDisplay(): string {
		if (entry.startTime && entry.endTime) {
			return `${formatTimeShort(entry.startTime)}-${formatTimeShort(entry.endTime)}`;
		}
		return formatDuration(entry.durationMinutes);
	}

	/** Build the calculated duration subtitle (only shown for time ranges) */
	function buildDurationSubtitle(): string | null {
		if (entry.startTime && entry.endTime) {
			return formatDuration(entry.durationMinutes);
		}
		return null;
	}

	/** Build the initial value for the time input based on current entry data */
	function buildTimeInputDefault(): string {
		if (entry.startTime && entry.endTime) {
			return `${formatTimeShort(entry.startTime)}-${formatTimeShort(entry.endTime)}`;
		}
		return formatDuration(entry.durationMinutes);
	}

	async function saveField(field: string, value: unknown) {
		try {
			await dataService.updateTimeEntry(entry.id, { [field]: value });
			onUpdated?.();
		} catch (error) {
			console.error(`Error saving ${field}:`, error);
		}
	}

	async function saveMultipleFields(data: Record<string, unknown>) {
		try {
			const response = await fetch(`/api/time-entries/${entry.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!response.ok) {
				throw new Error('Failed to update entry');
			}
			onUpdated?.();
		} catch (error) {
			console.error('Error saving entry:', error);
		}
	}

	// Time editing
	function startEditingTime() {
		timeInputValue = buildTimeInputDefault();
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
		if (event.key === 'Enter') {
			saveTimeInput();
		} else if (event.key === 'Escape') {
			cancelTimeEdit();
		}
	}

	function handleTimeBlur() {
		saveTimeInput();
	}

	// Contract editing
	function startEditingContract() {
		selectedContractId = entry.contractId;
		isEditingContract = true;
	}

	// Watch for contract selection changes
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

	function handleDescriptionInput(event: Event) {
		const input = event.target as HTMLInputElement;
		descriptionInputValue = input.value;

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
		if (event.key === 'Enter') {
			(event.target as HTMLInputElement).blur();
		} else if (event.key === 'Escape') {
			isEditingDescription = false;
		}
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

<div class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 transition-colors hover:bg-gray-50">
	<!-- LEFT: Contract + description -->
	<div class="min-w-0 flex-1">
		{#if isEditingContract}
			<div class="max-w-xs">
				<ContractSelect bind:selectedContractId compact={true} />
			</div>
		{:else}
			<button
				onclick={startEditingContract}
				class="text-left text-sm font-medium text-gray-900 hover:text-blue-600"
				title="Click to change contract"
			>
				{buildContextLabel()}
			</button>
		{/if}

		{#if isEditingDescription}
			<input
				type="text"
				value={descriptionInputValue}
				oninput={handleDescriptionInput}
				onblur={handleDescriptionBlur}
				onkeydown={handleDescriptionKeydown}
				class="mt-0.5 block w-full border-0 border-b border-gray-200 bg-transparent px-0 py-0.5 text-sm text-gray-600 focus:border-blue-400 focus:ring-0 focus:outline-none"
				autofocus
			/>
		{:else}
			<button
				onclick={startEditingDescription}
				class="mt-0.5 block text-left text-sm text-gray-500 hover:text-blue-600"
				title="Click to edit description"
			>
				{entry.description || 'Add description...'}
			</button>
		{/if}
	</div>

	<!-- RIGHT: Time display + delete -->
	<div class="shrink-0 text-right">
		{#if isEditingTime}
			<input
				type="text"
				bind:value={timeInputValue}
				onblur={handleTimeBlur}
				onkeydown={handleTimeKeydown}
				class="w-28 rounded border px-1.5 py-0.5 text-right text-sm font-medium focus:ring-1 focus:outline-none {timeInputError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
				placeholder="2h30m or 9:00-11:30"
				autofocus
			/>
		{:else}
			<button
				onclick={startEditingTime}
				class="text-right text-sm font-bold text-gray-900 hover:text-blue-600"
				title="Click to edit time"
			>
				{buildTimeDisplay()}
			</button>
			{#if buildDurationSubtitle()}
				<div class="text-xs text-gray-400">{buildDurationSubtitle()}</div>
			{/if}
		{/if}
	</div>

	<!-- Delete -->
	<div class="shrink-0">
		{#if isConfirmingDelete}
			<div class="flex items-center gap-1">
				<button
					onclick={handleDelete}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
				>
					{isDeleting ? '...' : 'Yes'}
				</button>
				<button
					onclick={() => (isConfirmingDelete = false)}
					disabled={isDeleting}
					class="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50"
				>
					No
				</button>
			</div>
		{:else}
			<button
				onclick={() => (isConfirmingDelete = true)}
				class="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50"
				title="Delete entry"
			>
				&times;
			</button>
		{/if}
	</div>
</div>
