<script lang="ts">
	import { untrack } from 'svelte';
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

	// The deliverable the current selection was made under. A work type belongs to one
	// deliverable, so a new deliverable clears the selection at once (sprint 032-CL), not only
	// after the new list loads: a form submitted in between must never send a stale pair.
	let selectionDeliverableId = untrack(() => deliverableId);

	// Reload work types when the deliverable changes
	$effect(() => {
		if (deliverableId !== selectionDeliverableId) {
			selectionDeliverableId = deliverableId;
			untrack(() => {
				if (selectedWorkTypeId) selectedWorkTypeId = '';
			});
		}
		if (deliverableId !== lastLoadedDeliverableId) {
			loadWorkTypes(deliverableId);
		}
	});

	$effect(() => {
		hasWorkTypes = workTypeList.length > 0;
	});

	const selectClasses = $derived(
		compact
			? 'block w-full min-w-0 rounded border border-line bg-surface px-1.5 py-1 text-sm focus:border-focus focus:ring-1 focus:ring-focus focus:outline-none'
			: 'block w-full min-w-0 rounded-md input-base bg-surface px-2 py-1.5 text-sm'
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
