<script lang="ts">
	import { enhance } from '$app/forms';
	import DeleteImpactDialog from './DeleteImpactDialog.svelte';
	import { escapeCancels, closeOnSuccess } from './form-enhancers';

	interface WorkTypeData {
		id: string;
		name: string;
		sortOrder: number;
		usage: { timeEntryCount: number; totalMinutes: number };
	}

	let { workType, deliverableId, deliverableName, actionBase }: {
		workType: WorkTypeData;
		deliverableId: string;
		deliverableName: string;
		actionBase: string;
	} = $props();

	let isEditing = $state(false);
	let isConfirmingDelete = $state(false);
	let editName = $state('');
	let editSortOrder = $state(0);

	function startEditing() {
		editName = workType.name;
		editSortOrder = workType.sortOrder;
		isEditing = true;
	}
	const cancelEditing = () => (isEditing = false);
</script>

<div class="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50">
	{#if isEditing}
		<form
			method="POST"
			action="{actionBase}?/updateWorkType"
			use:enhance={closeOnSuccess(cancelEditing)}
			use:escapeCancels={cancelEditing}
			class="flex w-full flex-wrap items-center gap-3"
		>
			<input type="hidden" name="work_type_id" value={workType.id} />
			<input type="hidden" name="deliverable_id" value={deliverableId} />
			<!-- svelte-ignore a11y_autofocus -->
			<input
				name="name"
				type="text"
				required
				autofocus
				aria-label="Work type name"
				bind:value={editName}
				class="rounded-md border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			/>
			<input
				name="sort_order"
				type="number"
				aria-label="Sort order"
				bind:value={editSortOrder}
				class="w-16 rounded-md border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			/>
			<button type="button" onclick={cancelEditing} class="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50">Cancel</button>
			<button type="submit" class="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700">Save</button>
		</form>
	{:else}
		<div class="flex items-center gap-2">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-stone-300"></span>
			<span class="text-sm text-stone-700">{workType.name}</span>
			<span class="text-xs text-stone-400">({workType.sortOrder})</span>
		</div>
		<div class="flex items-center gap-2">
			<button onclick={startEditing} class="text-xs text-stone-500 hover:text-blue-600">Edit</button>
			<button onclick={() => (isConfirmingDelete = true)} class="text-xs text-red-500 hover:text-red-700">Delete</button>
		</div>
	{/if}
</div>

{#if isConfirmingDelete}
	<DeleteImpactDialog
		title="Delete work type “{workType.name}”?"
		usage={workType.usage}
		deleteAction="{actionBase}?/deleteWorkType"
		deleteWithWorkLabel="Delete, keep a note on entries"
		deleteConsequence="The entries keep their deliverable. Their work type is cleared and “Formerly: {deliverableName} / {workType.name}” is added to their description."
		hiddenFields={{ work_type_id: workType.id, deliverable_id: deliverableId }}
		onClose={() => (isConfirmingDelete = false)}
	/>
{/if}
