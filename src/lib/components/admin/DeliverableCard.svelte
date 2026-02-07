<script lang="ts">
	import { enhance } from '$app/forms';
	import WorkTypeRow from './WorkTypeRow.svelte';

	interface DeliverableData {
		id: string;
		name: string;
		sortOrder: number;
		workTypes: Array<{ id: string; name: string; sortOrder: number }>;
	}

	let { deliverable, actionBase }: { deliverable: DeliverableData; actionBase: string } = $props();

	let isEditing = $state(false);
	let isDeleting = $state(false);
	let showAddWorkType = $state(false);
	let editName = $state(deliverable.name);
	let editSortOrder = $state(deliverable.sortOrder);
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-sm">
	<!-- Deliverable Header -->
	<div class="border-b border-gray-100 p-4">
		{#if isEditing}
			<form
				method="POST"
				action="{actionBase}?/updateDeliverable"
				use:enhance={() => {
					return async ({ update }) => {
						isEditing = false;
						await update();
					};
				}}
				class="flex items-center gap-3"
			>
				<input type="hidden" name="deliverable_id" value={deliverable.id} />
				<input
					name="name"
					type="text"
					required
					bind:value={editName}
					class="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				<input
					name="sort_order"
					type="number"
					bind:value={editSortOrder}
					class="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				<button type="submit" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save</button>
				<button type="button" onclick={() => { isEditing = false; editName = deliverable.name; editSortOrder = deliverable.sortOrder; }} class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<h4 class="font-medium text-gray-900">{deliverable.name}</h4>
					<span class="text-xs text-gray-400">order: {deliverable.sortOrder}</span>
				</div>
				<div class="flex items-center gap-2">
					<button onclick={() => (showAddWorkType = !showAddWorkType)} class="text-sm text-blue-600 hover:text-blue-800">
						{showAddWorkType ? 'Cancel' : '+ Work Type'}
					</button>
					<button onclick={() => (isEditing = true)} class="text-sm text-gray-500 hover:text-blue-600">Edit</button>
					{#if isDeleting}
						<form method="POST" action="{actionBase}?/deleteDeliverable" use:enhance class="inline">
							<input type="hidden" name="deliverable_id" value={deliverable.id} />
							<button type="submit" class="text-sm font-medium text-red-600 hover:text-red-800">Confirm</button>
						</form>
						<button onclick={() => (isDeleting = false)} class="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
					{:else}
						<button onclick={() => (isDeleting = true)} class="text-sm text-red-500 hover:text-red-700">Delete</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Add Work Type Form -->
	{#if showAddWorkType}
		<div class="border-b border-gray-100 bg-gray-50 p-4">
			<form method="POST" action="{actionBase}?/createWorkType" use:enhance class="flex items-end gap-3">
				<input type="hidden" name="deliverable_id" value={deliverable.id} />
				<div>
					<label for="new-wt-name-{deliverable.id}" class="block text-xs font-medium text-gray-700">Name</label>
					<input
						id="new-wt-name-{deliverable.id}"
						name="name"
						type="text"
						required
						class="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="Design Review"
					/>
				</div>
				<div>
					<label for="new-wt-order-{deliverable.id}" class="block text-xs font-medium text-gray-700">Order</label>
					<input
						id="new-wt-order-{deliverable.id}"
						name="sort_order"
						type="number"
						value="0"
						class="mt-1 block w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					/>
				</div>
				<button type="submit" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Add</button>
			</form>
		</div>
	{/if}

	<!-- Work Types List -->
	{#if deliverable.workTypes && deliverable.workTypes.length > 0}
		<div class="divide-y divide-gray-50">
			{#each deliverable.workTypes as workType (workType.id)}
				<WorkTypeRow {workType} deliverableId={deliverable.id} {actionBase} />
			{/each}
		</div>
	{:else}
		<div class="p-4 text-center text-sm text-gray-400">
			No work types yet.
		</div>
	{/if}
</div>
