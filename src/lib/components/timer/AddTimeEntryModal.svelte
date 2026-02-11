<script lang="ts">
	import ContractSelect from './ContractSelect.svelte';
	import { getDataService } from '$lib/services/context';

	const dataService = getDataService();

	let {
		onCreated,
		onClose
	}: {
		onCreated: () => void;
		onClose: () => void;
	} = $props();

	let entryDate = $state(todayDateString());
	let durationText = $state('');
	let selectedContractId = $state('');
	let description = $state('');
	let isSaving = $state(false);
	let errorMessage = $state('');

	function todayDateString(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/** Parse "HH:MM" or "H:MM" into total minutes, returns null if invalid */
	function parseDurationToMinutes(text: string): number | null {
		const trimmed = text.trim();
		const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
		if (!match) return null;
		const hours = parseInt(match[1], 10);
		const minutes = parseInt(match[2], 10);
		if (minutes >= 60) return null;
		return hours * 60 + minutes;
	}

	const durationMinutes = $derived(parseDurationToMinutes(durationText));
	const isFormValid = $derived(
		!!selectedContractId && !!entryDate && durationMinutes !== null && durationMinutes > 0
	);

	async function handleCreate() {
		if (!isFormValid || durationMinutes === null) return;
		isSaving = true;
		errorMessage = '';
		try {
			await dataService.createTimeEntry({
				date: entryDate,
				durationMinutes,
				contractId: selectedContractId,
				description: description.trim() || undefined
			});
			onCreated();
		} catch (caughtError) {
			errorMessage =
				caughtError instanceof Error ? caughtError.message : 'Failed to create entry';
		} finally {
			isSaving = false;
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
	onclick={handleBackdropClick}
>
	<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Add Time Entry</h2>

		<div class="space-y-3">
			<div>
				<label for="entry-date" class="block text-xs font-medium text-gray-600">Date</label>
				<input
					id="entry-date"
					type="date"
					bind:value={entryDate}
					class="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="entry-duration" class="block text-xs font-medium text-gray-600">
					Duration (HH:MM)
				</label>
				<input
					id="entry-duration"
					type="text"
					bind:value={durationText}
					placeholder="1:30"
					class="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="entry-contract" class="block text-xs font-medium text-gray-600">
					Contract <span class="text-red-500">*</span>
				</label>
				<div class="mt-0.5">
					<ContractSelect bind:selectedContractId />
				</div>
			</div>

			<div>
				<label for="entry-description" class="block text-xs font-medium text-gray-600">
					Description
				</label>
				<textarea
					id="entry-description"
					bind:value={description}
					rows="2"
					class="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="What did you work on?"
				></textarea>
			</div>
		</div>

		{#if errorMessage}
			<div class="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-600">{errorMessage}</div>
		{/if}

		<div class="mt-4 flex gap-2">
			<button
				onclick={handleCreate}
				disabled={!isFormValid || isSaving}
				class="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isSaving ? 'Creating...' : 'Create'}
			</button>
			<button
				onclick={onClose}
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
