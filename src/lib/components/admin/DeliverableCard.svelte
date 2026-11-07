<script lang="ts">
	import { enhance } from '$app/forms';
	import WorkTypeRow from './WorkTypeRow.svelte';
	import DeleteImpactDialog from './DeleteImpactDialog.svelte';
	import { escapeCancels, closeOnSuccess } from './form-enhancers';

	type EntryUsage = { timeEntryCount: number; totalMinutes: number };
	interface DeliverableData {
		id: string;
		name: string;
		sortOrder: number;
		usage: EntryUsage;
		workTypes: Array<{ id: string; name: string; sortOrder: number; usage: EntryUsage }>;
	}

	let { deliverable, actionBase }: { deliverable: DeliverableData; actionBase: string } = $props();

	let isEditing = $state(false);
	let isConfirmingDelete = $state(false);
	let showAddWorkType = $state(false);
	let editName = $state('');
	let editSortOrder = $state(0);

	function startEditing() {
		editName = deliverable.name;
		editSortOrder = deliverable.sortOrder;
		isEditing = true;
	}
	const cancelEditing = () => (isEditing = false);
</script>

<div class="rounded-lg border border-divider bg-surface shadow-sm">
	<!-- Deliverable Header -->
	<div class="border-b border-chalk-100 p-4">
		{#if isEditing}
			<form
				method="POST"
				action="{actionBase}?/updateDeliverable"
				use:enhance={closeOnSuccess(cancelEditing)}
				use:escapeCancels={cancelEditing}
				class="flex flex-wrap items-center gap-3"
			>
				<input type="hidden" name="deliverable_id" value={deliverable.id} />
				<!-- svelte-ignore a11y_autofocus -->
				<input
					name="name"
					type="text"
					required
					autofocus
					aria-label="Deliverable name"
					bind:value={editName}
					class="rounded-md input-base px-3 py-1.5 text-sm"
				/>
				<input
					name="sort_order"
					type="number"
					aria-label="Sort order"
					bind:value={editSortOrder}
					class="w-20 rounded-md input-base px-3 py-1.5 text-sm"
				/>
				<button type="button" onclick={cancelEditing} class="rounded-md btn-secondary px-3 py-1.5 text-sm">Cancel</button>
				<button type="submit" class="rounded-md btn-primary px-3 py-1.5 text-sm font-medium">Save</button>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<h4 class="font-medium text-ink">{deliverable.name}</h4>
					<span class="text-xs text-ink-faint">order: {deliverable.sortOrder}</span>
				</div>
				<div class="flex items-center gap-2">
					{#if !showAddWorkType}
						<button onclick={() => (showAddWorkType = true)} class="text-sm text-pine-600 hover:text-pine-800 pointer-coarse:min-h-11">+ Work Type</button>
					{/if}
					<button onclick={startEditing} class="text-sm text-ink-faint hover:text-pine-600 pointer-coarse:min-h-11">Edit</button>
					<button onclick={() => (isConfirmingDelete = true)} class="text-sm text-rust-500 hover:text-rust-700 pointer-coarse:min-h-11">Delete</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Add Work Type Form -->
	{#if showAddWorkType}
		<div class="border-b border-chalk-100 bg-chalk-50 p-4">
			<form
				method="POST"
				action="{actionBase}?/createWorkType"
				use:enhance={closeOnSuccess(() => (showAddWorkType = false))}
				use:escapeCancels={() => (showAddWorkType = false)}
				class="flex flex-wrap items-end gap-3"
			>
				<input type="hidden" name="deliverable_id" value={deliverable.id} />
				<div>
					<label for="new-wt-name-{deliverable.id}" class="block text-xs font-medium text-ink-soft">Name</label>
					<input
						id="new-wt-name-{deliverable.id}"
						name="name"
						type="text"
						required
						class="mt-1 block rounded-md input-base px-3 py-1.5 text-sm"
						placeholder="Design Review"
					/>
				</div>
				<div>
					<label for="new-wt-order-{deliverable.id}" class="block text-xs font-medium text-ink-soft">Order</label>
					<input
						id="new-wt-order-{deliverable.id}"
						name="sort_order"
						type="number"
						value="0"
						class="mt-1 block w-20 rounded-md input-base px-3 py-1.5 text-sm"
					/>
				</div>
				<button type="button" onclick={() => (showAddWorkType = false)} class="rounded-md btn-secondary px-3 py-1.5 text-sm">Cancel</button>
				<button type="submit" class="rounded-md btn-primary px-3 py-1.5 text-sm font-medium">Add</button>
			</form>
		</div>
	{/if}

	<!-- Work Types List -->
	{#if deliverable.workTypes && deliverable.workTypes.length > 0}
		<div class="divide-y divide-chalk-50">
			{#each deliverable.workTypes as workType (workType.id)}
				<WorkTypeRow {workType} deliverableId={deliverable.id} deliverableName={deliverable.name} {actionBase} />
			{/each}
		</div>
	{:else}
		<div class="p-4 text-center text-sm text-ink-faint">
			No work types yet.
		</div>
	{/if}
</div>

{#if isConfirmingDelete}
	<DeleteImpactDialog
		title="Delete deliverable “{deliverable.name}”?"
		usage={deliverable.usage}
		deleteAction="{actionBase}?/deleteDeliverable"
		deleteWithWorkLabel="Delete, keep a note on entries"
		deleteConsequence="The entries stay on this contract. Their deliverable is cleared and “Formerly: {deliverable.name}” is added to their description. Its work types are deleted too."
		hiddenFields={{ deliverable_id: deliverable.id }}
		onClose={() => (isConfirmingDelete = false)}
	/>
{/if}
