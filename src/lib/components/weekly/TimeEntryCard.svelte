<script lang="ts">
	import { formatTimeShort, formatDuration } from '$lib/utils/iso-week';
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';

	type EntryData = {
		id: string;
		startTime: string | null;
		endTime: string | null;
		durationMinutes: number;
		contractId: string;
		contractName: string;
		clientName: string;
		clientShortCode: string;
		deliverableName: string | null;
		workTypeName: string | null;
		description: string | null;
		date: string;
	};

	let {
		entry,
		onUpdated
	}: {
		entry: EntryData;
		onUpdated?: () => void;
	} = $props();

	// Inline editing states
	let isEditingDuration = $state(false);
	let isEditingContract = $state(false);
	let isEditingDescription = $state(false);
	let isConfirmingDelete = $state(false);
	let isDeleting = $state(false);

	// Editable values
	let durationInputValue = $state('');
	let selectedContractId = $state('');
	let descriptionInputValue = $state('');
	let descriptionDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	function buildContextLabel(): string {
		const parts = [entry.clientName, entry.contractName];
		if (entry.deliverableName) parts.push(entry.deliverableName);
		if (entry.workTypeName) parts.push(entry.workTypeName);
		return parts.join(' / ');
	}

	function buildTimeRange(): string {
		if (entry.startTime && entry.endTime) {
			return `${formatTimeShort(entry.startTime)}-${formatTimeShort(entry.endTime)}`;
		}
		return formatDuration(entry.durationMinutes);
	}

	/** Format minutes as HH:MM for the duration input */
	function minutesToHhmm(totalMinutes: number): string {
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	}

	/** Parse HH:MM string to total minutes */
	function hhmmToMinutes(hhmm: string): number | null {
		const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
		if (!match) return null;
		const hours = parseInt(match[1], 10);
		const minutes = parseInt(match[2], 10);
		if (minutes >= 60) return null;
		return hours * 60 + minutes;
	}

	async function saveField(field: string, value: unknown) {
		try {
			const response = await fetch(`/api/time-entries/${entry.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [field]: value })
			});
			if (!response.ok) {
				throw new Error(`Failed to update ${field}`);
			}
			onUpdated?.();
		} catch (error) {
			console.error(`Error saving ${field}:`, error);
		}
	}

	// Duration editing
	function startEditingDuration() {
		durationInputValue = minutesToHhmm(entry.durationMinutes);
		isEditingDuration = true;
	}

	function handleDurationBlur() {
		const parsedMinutes = hhmmToMinutes(durationInputValue);
		if (parsedMinutes !== null && parsedMinutes !== entry.durationMinutes && parsedMinutes > 0) {
			saveField('durationMinutes', parsedMinutes);
		}
		isEditingDuration = false;
	}

	function handleDurationKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			(event.target as HTMLInputElement).blur();
		} else if (event.key === 'Escape') {
			isEditingDuration = false;
		}
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
			const response = await fetch(`/api/time-entries/${entry.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				throw new Error('Failed to delete entry');
			}
			onUpdated?.();
		} catch (error) {
			console.error('Error deleting entry:', error);
		} finally {
			isDeleting = false;
			isConfirmingDelete = false;
		}
	}
</script>

<div class="flex items-center gap-3 border-b border-gray-100 px-1 py-2 transition-colors hover:bg-gray-50">
	<!-- Time range -->
	<div class="w-24 shrink-0 text-sm text-gray-500">
		{buildTimeRange()}
	</div>

	<!-- Contract + description -->
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

	<!-- Duration -->
	<div class="shrink-0">
		{#if isEditingDuration}
			<input
				type="text"
				value={durationInputValue}
				oninput={(event) => { durationInputValue = (event.target as HTMLInputElement).value; }}
				onblur={handleDurationBlur}
				onkeydown={handleDurationKeydown}
				class="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-center text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				placeholder="HH:MM"
				autofocus
			/>
		{:else}
			<button
				onclick={startEditingDuration}
				class="text-sm font-medium text-gray-700 hover:text-blue-600"
				title="Click to edit duration"
			>
				{formatDuration(entry.durationMinutes)}
			</button>
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
