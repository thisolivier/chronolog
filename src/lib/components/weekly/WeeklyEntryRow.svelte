<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatTimeShort, formatDuration } from '$lib/utils/iso-week';
	import { parseTimeInput } from '$lib/utils/time-parse';
	import { getDataService } from '$lib/services/context';

	const dataService = getDataService();

	type EntryData = {
		id: string;
		startTime: string | null;
		endTime: string | null;
		durationMinutes: number;
		contractName: string;
		clientName: string;
		clientShortCode: string;
		deliverableName: string | null;
		workTypeName: string | null;
		description: string | null;
		date: string;
	};

	let { entry }: { entry: EntryData } = $props();

	let isConfirmingDelete = $state(false);
	let isDeleting = $state(false);
	let isEditingTime = $state(false);
	let timeInputValue = $state('');
	let isInputInvalid = $state(false);
	let isSaving = $state(false);

	function buildContextLabel(): string {
		const parts = [entry.clientName, entry.contractName];
		if (entry.deliverableName) parts.push(entry.deliverableName);
		if (entry.workTypeName) parts.push(entry.workTypeName);
		return parts.join(' / ');
	}

	function buildTimeRangeDisplay(): string {
		if (entry.startTime && entry.endTime) {
			return `${formatTimeShort(entry.startTime)}-${formatTimeShort(entry.endTime)}`;
		}
		return formatDuration(entry.durationMinutes);
	}

	function buildDurationSubtext(): string | null {
		if (entry.startTime && entry.endTime) {
			return `(${formatDuration(entry.durationMinutes)})`;
		}
		return null;
	}

	function getInitialInputValue(): string {
		if (entry.startTime && entry.endTime) {
			return `${formatTimeShort(entry.startTime)}-${formatTimeShort(entry.endTime)}`;
		}
		return formatDuration(entry.durationMinutes);
	}

	function startEditing(): void {
		timeInputValue = getInitialInputValue();
		isInputInvalid = false;
		isEditingTime = true;
	}

	function cancelEditing(): void {
		isEditingTime = false;
		isInputInvalid = false;
	}

	async function saveTimeEdit(): Promise<void> {
		const parseResult = parseTimeInput(timeInputValue);

		if (parseResult.type === 'invalid') {
			isInputInvalid = true;
			return;
		}

		isSaving = true;
		isInputInvalid = false;

		try {
			const updateData: Record<string, unknown> = {
				durationMinutes: parseResult.durationMinutes
			};

			if (parseResult.type === 'range') {
				updateData.startTime = parseResult.startTime;
				updateData.endTime = parseResult.endTime;
			} else {
				// Duration-only: clear start/end times
				updateData.startTime = null;
				updateData.endTime = null;
			}

			await dataService.updateTimeEntry(entry.id, updateData as Record<string, unknown>);
			isEditingTime = false;
			await invalidateAll();
		} finally {
			isSaving = false;
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveTimeEdit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
		}
	}

	function handleBlur(): void {
		// Small delay to allow Escape key to fire first
		setTimeout(() => {
			if (isEditingTime) {
				saveTimeEdit();
			}
		}, 100);
	}

	async function handleDelete() {
		isDeleting = true;
		try {
			await dataService.deleteTimeEntry(entry.id);
			await invalidateAll();
		} catch (error) {
			console.error('Error deleting entry:', error);
		} finally {
			isDeleting = false;
			isConfirmingDelete = false;
		}
	}
</script>

<div
	class="flex items-start gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm transition-all hover:bg-gray-50"
	class:opacity-50={isSaving}
>
	<!-- LEFT: Context label + description -->
	<div class="min-w-0 flex-1">
		<div class="text-sm font-medium text-gray-900">
			{buildContextLabel()}
		</div>
		{#if entry.description}
			<div class="mt-0.5 text-sm text-gray-600">
				{entry.description}
			</div>
		{/if}
	</div>

	<!-- RIGHT: Time display / editor -->
	<div class="shrink-0 text-right">
		{#if isEditingTime}
			<input
				type="text"
				bind:value={timeInputValue}
				onkeydown={handleKeydown}
				onblur={handleBlur}
				class="w-32 rounded border px-2 py-1 text-right text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 {isInputInvalid
					? 'border-red-500 focus:ring-red-300'
					: 'border-gray-300'}"
				autofocus
			/>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="cursor-pointer rounded px-2 py-1 hover:bg-blue-50"
				onclick={startEditing}
			>
				<div class="text-sm font-bold text-gray-900">
					{buildTimeRangeDisplay()}
				</div>
				{#if buildDurationSubtext()}
					<div class="text-xs text-gray-500">
						{buildDurationSubtext()}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- DELETE button -->
	<div class="flex shrink-0 items-center">
		{#if isConfirmingDelete}
			<button
				onclick={handleDelete}
				disabled={isDeleting}
				class="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
			>
				{isDeleting ? '...' : 'Confirm'}
			</button>
			<button
				onclick={() => (isConfirmingDelete = false)}
				disabled={isDeleting}
				class="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
			>
				Cancel
			</button>
		{:else}
			<button
				onclick={() => (isConfirmingDelete = true)}
				class="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
			>
				Delete
			</button>
		{/if}
	</div>
</div>
