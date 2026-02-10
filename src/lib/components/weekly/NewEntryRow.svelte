<script lang="ts">
	import { parseTimeInput } from '$lib/utils/time-parse';
	import { apiCreateManualEntry } from '$lib/components/timer/timer-api';
	import ContractSelect from '$lib/components/timer/ContractSelect.svelte';

	let {
		date,
		onEntryCreated,
		onCancel
	}: {
		date: string;
		onEntryCreated: () => void;
		onCancel: () => void;
	} = $props();

	let selectedContractId = $state('');
	let descriptionInput = $state('');
	let timeInputValue = $state('');
	let timeInputError = $state(false);
	let isSubmitting = $state(false);

	const canSubmit = $derived(
		selectedContractId !== '' && timeInputValue.trim() !== '' && !timeInputError
	);

	async function handleSubmit() {
		if (isSubmitting) return;

		const parsed = parseTimeInput(timeInputValue);
		if (parsed.type === 'invalid') {
			timeInputError = true;
			return;
		}

		if (!selectedContractId) return;

		isSubmitting = true;
		timeInputError = false;

		try {
			const entryData: Parameters<typeof apiCreateManualEntry>[0] = {
				date,
				durationMinutes: parsed.durationMinutes,
				contractId: selectedContractId,
				description: descriptionInput.trim() || undefined
			};

			if (parsed.type === 'range') {
				entryData.startTime = parsed.startTime;
				entryData.endTime = parsed.endTime;
			}

			await apiCreateManualEntry(entryData);
			onEntryCreated();
		} catch (error) {
			console.error('Error creating entry:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && canSubmit) {
			handleSubmit();
		} else if (event.key === 'Escape') {
			onCancel();
		}
	}

	function handleTimeInput(event: Event) {
		const input = event.target as HTMLInputElement;
		timeInputValue = input.value;
		// Clear error on typing
		if (timeInputError) {
			timeInputError = false;
		}
	}
</script>

<div class="flex items-center gap-3 border-b border-gray-100 px-1 py-2">
	<!-- LEFT: Contract + description -->
	<div class="min-w-0 flex-1">
		<div class="max-w-xs">
			<ContractSelect bind:selectedContractId compact={true} />
		</div>
		<input
			type="text"
			bind:value={descriptionInput}
			onkeydown={handleKeydown}
			placeholder="Description..."
			class="mt-0.5 block w-full border-0 border-b border-gray-200 bg-transparent px-0 py-0.5 text-sm text-gray-600 placeholder-gray-400 focus:border-blue-400 focus:ring-0 focus:outline-none"
		/>
	</div>

	<!-- RIGHT: Time input + cancel -->
	<div class="shrink-0">
		<input
			type="text"
			value={timeInputValue}
			oninput={handleTimeInput}
			onkeydown={handleKeydown}
			class="w-28 rounded border px-1.5 py-0.5 text-right text-sm font-medium focus:ring-1 focus:outline-none {timeInputError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
			placeholder="2h30m"
			autofocus
		/>
	</div>

	<div class="shrink-0">
		<button
			onclick={onCancel}
			class="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100"
			title="Cancel"
		>
			&times;
		</button>
	</div>
</div>
