<script lang="ts">
	import { enhance } from '$app/forms';

	let { workType, deliverableId, actionBase }: {
		workType: any;
		deliverableId: string;
		actionBase: string;
	} = $props();

	let isEditing = $state(false);
	let isDeleting = $state(false);
	let editName = $state(workType.name);
	let editSortOrder = $state(workType.sortOrder);
</script>

<div class="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
	{#if isEditing}
		<form
			method="POST"
			action="{actionBase}?/updateWorkType"
			use:enhance={() => {
				return async ({ update }) => {
					isEditing = false;
					await update();
				};
			}}
			class="flex w-full items-center gap-3"
		>
			<input type="hidden" name="work_type_id" value={workType.id} />
			<input type="hidden" name="deliverable_id" value={deliverableId} />
			<input
				name="name"
				type="text"
				required
				bind:value={editName}
				class="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			/>
			<input
				name="sort_order"
				type="number"
				bind:value={editSortOrder}
				class="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			/>
			<button type="submit" class="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700">Save</button>
			<button
				type="button"
				onclick={() => { isEditing = false; editName = workType.name; editSortOrder = workType.sortOrder; }}
				class="text-xs text-gray-500 hover:text-gray-700"
			>
				Cancel
			</button>
		</form>
	{:else}
		<div class="flex items-center gap-2">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-gray-300"></span>
			<span class="text-sm text-gray-700">{workType.name}</span>
			<span class="text-xs text-gray-400">({workType.sortOrder})</span>
		</div>
		<div class="flex items-center gap-2">
			<button onclick={() => (isEditing = true)} class="text-xs text-gray-500 hover:text-blue-600">Edit</button>
			{#if isDeleting}
				<form method="POST" action="{actionBase}?/deleteWorkType" use:enhance class="inline">
					<input type="hidden" name="work_type_id" value={workType.id} />
					<input type="hidden" name="deliverable_id" value={deliverableId} />
					<button type="submit" class="text-xs font-medium text-red-600 hover:text-red-800">Confirm</button>
				</form>
				<button onclick={() => (isDeleting = false)} class="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
			{:else}
				<button onclick={() => (isDeleting = true)} class="text-xs text-red-500 hover:text-red-700">Delete</button>
			{/if}
		</div>
	{/if}
</div>
