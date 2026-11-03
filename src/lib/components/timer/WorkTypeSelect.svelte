<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import type { WorkTypeOption } from '$lib/services/types';

	const dataService = getDataService();

	let {
		deliverableId,
		selectedWorkTypeId = $bindable(''),
		hasWorkTypes = $bindable(false),
		compact = false,
		id = undefined,
		onChange = undefined
	}: {
		deliverableId: string;
		selectedWorkTypeId: string;
		/** Bindable read-out so a parent can hide its label when the select is not rendered */
		hasWorkTypes?: boolean;
		compact?: boolean;
		id?: string;
		/** Fired after the user picks a work type (empty string = none) */
		onChange?: (workTypeId: string) => void;
	} = $props();

	let workTypeList: WorkTypeOption[] = $state([]);
	let lastLoadedDeliverableId = $state('');

	async function loadWorkTypes(targetDeliverableId: string) {
		if (!targetDeliverableId) {
			workTypeList = [];
		} else {
			try {
				workTypeList = await dataService.getWorkTypes(targetDeliverableId);
			} catch {
				workTypeList = [];
			}
		}
		lastLoadedDeliverableId = targetDeliverableId;
		// A work type belongs to one deliverable: drop a selection that no longer applies
		const selectionStillValid = workTypeList.some((workType) => workType.id === selectedWorkTypeId);
		if (selectedWorkTypeId && !selectionStillValid) {
			selectedWorkTypeId = '';
		}
	}

	// Reload work types when the deliverable changes
	$effect(() => {
		if (deliverableId !== lastLoadedDeliverableId) {
			loadWorkTypes(deliverableId);
		}
	});

	$effect(() => {
		hasWorkTypes = workTypeList.length > 0;
	});

	const selectClasses = $derived(
		compact
			? 'block w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
			: 'block w-full min-w-0 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
	);

	function handleChange(event: Event) {
		const nextWorkTypeId = (event.currentTarget as HTMLSelectElement).value;
		selectedWorkTypeId = nextWorkTypeId;
		onChange?.(nextWorkTypeId);
	}
</script>

{#if hasWorkTypes}
	<select {id} bind:value={selectedWorkTypeId} onchange={handleChange} class={selectClasses}>
		<option value="">No work type</option>
		{#each workTypeList as workType (workType.id)}
			<option value={workType.id}>{workType.name}</option>
		{/each}
	</select>
{/if}
