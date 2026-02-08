<script lang="ts">
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';
	import { getDataService } from '$lib/sync/context';

	let {
		date,
		onEntryCreated
	}: {
		date: string;
		onEntryCreated: () => void;
	} = $props();

	const dataService = getDataService();

	let durationInput = $state('');
	let selectedContractId = $state('');
	let descriptionInput = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	/** Parse HH:MM string to total minutes */
	function parseDurationToMinutes(input: string): number | null {
		// Try HH:MM format
		const hhmmMatch = input.match(/^(\d{1,2}):(\d{2})$/);
		if (hhmmMatch) {
			const hours = parseInt(hhmmMatch[1], 10);
			const minutes = parseInt(hhmmMatch[2], 10);
			if (minutes < 60) return hours * 60 + minutes;
		}
		// Try plain number (treated as minutes)
		const plainNumber = parseInt(input, 10);
		if (!isNaN(plainNumber) && plainNumber > 0) return plainNumber;
		return null;
	}

	const canSubmit = $derived(
		durationInput.trim() !== '' && selectedContractId !== ''
	);

	async function handleSubmit() {
		if (!canSubmit || isSubmitting) return;

		const parsedMinutes = parseDurationToMinutes(durationInput.trim());
		if (parsedMinutes === null || parsedMinutes <= 0) {
			errorMessage = 'Invalid duration (use HH:MM or minutes)';
			return;
		}

		isSubmitting = true;
		errorMessage = '';

		try {
			await dataService.createTimeEntry({
				date,
				durationMinutes: parsedMinutes,
				contractId: selectedContractId,
				description: descriptionInput.trim() || undefined
			});

			// Clear form
			durationInput = '';
			selectedContractId = '';
			descriptionInput = '';

			onEntryCreated();
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Failed to create entry';
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && canSubmit) {
			handleSubmit();
		}
	}
</script>

<div class="flex items-center gap-2 px-1 py-1.5">
	<!-- Duration -->
	<input
		type="text"
		bind:value={durationInput}
		onkeydown={handleKeydown}
		placeholder="0:30"
		class="w-14 rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-center text-xs text-gray-500 placeholder-gray-300 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none"
	/>

	<!-- Contract -->
	<div class="w-36 shrink-0">
		<ContractSelect bind:selectedContractId compact={true} />
	</div>

	<!-- Description -->
	<input
		type="text"
		bind:value={descriptionInput}
		onkeydown={handleKeydown}
		placeholder="Description..."
		class="min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-xs text-gray-500 placeholder-gray-300 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none"
	/>

	<!-- Add button -->
	<button
		onclick={handleSubmit}
		disabled={!canSubmit || isSubmitting}
		class="shrink-0 rounded px-2 py-1 text-xs font-medium text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
		title="Add entry"
	>
		{isSubmitting ? '...' : '+'}
	</button>
</div>

{#if errorMessage}
	<div class="px-1 pb-1 text-xs text-red-500">{errorMessage}</div>
{/if}
