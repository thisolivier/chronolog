<script lang="ts">
	import CascadingSelects from './CascadingSelects.svelte';

	let {
		startTime,
		endTime,
		elapsedSeconds,
		initialContractId = '',
		initialDescription = '',
		onSave,
		onDiscard
	}: {
		startTime: string;
		endTime: string;
		elapsedSeconds: number;
		initialContractId?: string;
		initialDescription?: string;
		onSave: (data: {
			contractId: string;
			deliverableId: string;
			workTypeId: string;
			description: string;
		}) => void;
		onDiscard: () => void;
	} = $props();

	let selectedContractId = $state(initialContractId);
	let selectedDeliverableId = $state('');
	let selectedWorkTypeId = $state('');
	let description = $state(initialDescription);
	let isSaving = $state(false);

	function formatDuration(totalSeconds: number): string {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	}

	function formatTimeForDisplay(timeString: string): string {
		if (!timeString) return '--:--';
		return timeString.substring(0, 5);
	}

	async function handleSave() {
		if (!selectedContractId) return;
		isSaving = true;
		onSave({
			contractId: selectedContractId,
			deliverableId: selectedDeliverableId,
			workTypeId: selectedWorkTypeId,
			description
		});
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between text-sm text-gray-600">
		<span>
			{formatTimeForDisplay(startTime)} - {formatTimeForDisplay(endTime)}
		</span>
		<span class="font-medium">{formatDuration(elapsedSeconds)}</span>
	</div>

	<CascadingSelects
		bind:selectedContractId
		bind:selectedDeliverableId
		bind:selectedWorkTypeId
	/>

	<div>
		<label for="timer-description" class="block text-xs font-medium text-gray-600">
			Description
		</label>
		<textarea
			id="timer-description"
			bind:value={description}
			rows="2"
			class="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			placeholder="What did you work on?"
		></textarea>
	</div>

	<div class="flex gap-2">
		<button
			onclick={handleSave}
			disabled={!selectedContractId || isSaving}
			class="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isSaving ? 'Saving...' : 'Save'}
		</button>
		<button
			onclick={onDiscard}
			class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
		>
			Discard
		</button>
	</div>
</div>
