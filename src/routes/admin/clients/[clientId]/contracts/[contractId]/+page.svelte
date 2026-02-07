<script lang="ts">
	import { enhance } from '$app/forms';
	import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';
	import DeliverableCard from '$lib/components/admin/DeliverableCard.svelte';

	let { data, form } = $props();

	let isEditingContract = $state(false);
	let showCreateDeliverableForm = $state(false);

	let actionBase = $derived(`/admin/clients/${data.client.id}/contracts/${data.contract.id}`);
</script>

<div class="space-y-6">
	<AdminBreadcrumb
		items={[
			{ label: 'Clients', href: '/admin/clients' },
			{ label: data.client.name, href: `/admin/clients/${data.client.id}` },
			{ label: data.contract.name }
		]}
	/>

	{#if form?.error}
		<div class="rounded-md bg-red-50 p-4 text-sm text-red-700">{form.error}</div>
	{/if}
	{#if form?.success}
		<div class="rounded-md bg-green-50 p-4 text-sm text-green-700">
			Operation completed successfully.
		</div>
	{/if}

	<!-- Contract Header -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		{#if isEditingContract}
			<form method="POST" action="{actionBase}?/updateContract" use:enhance={() => {
				return async ({ update }) => {
					isEditingContract = false;
					await update();
				};
			}} class="space-y-4">
				<h2 class="text-lg font-medium text-gray-900">Edit Contract</h2>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="edit-contract-name" class="block text-sm font-medium text-gray-700">Name</label>
						<input
							id="edit-contract-name"
							name="name"
							type="text"
							required
							value={data.contract.name}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="edit-contract-desc" class="block text-sm font-medium text-gray-700">Description</label>
						<input
							id="edit-contract-desc"
							name="description"
							type="text"
							value={data.contract.description || ''}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<input
						id="edit-contract-active"
						name="is_active"
						type="checkbox"
						checked={data.contract.isActive}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<label for="edit-contract-active" class="text-sm text-gray-700">Active</label>
				</div>
				<div class="flex gap-2">
					<button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
					<button type="button" onclick={() => (isEditingContract = false)} class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
				</div>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<div>
					<div class="flex items-center gap-3">
						<h2 class="text-xl font-semibold text-gray-900">{data.contract.name}</h2>
						<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {data.contract.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
							{data.contract.isActive ? 'Active' : 'Inactive'}
						</span>
					</div>
					{#if data.contract.description}
						<p class="mt-1 text-sm text-gray-500">{data.contract.description}</p>
					{/if}
				</div>
				<button
					onclick={() => (isEditingContract = true)}
					class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Edit Contract
				</button>
			</div>
		{/if}
	</div>

	<!-- Deliverables Section -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-medium text-gray-900">Deliverables</h3>
			<button
				onclick={() => (showCreateDeliverableForm = !showCreateDeliverableForm)}
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
			>
				{showCreateDeliverableForm ? 'Cancel' : 'Add Deliverable'}
			</button>
		</div>

		{#if showCreateDeliverableForm}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<h4 class="mb-4 text-base font-medium text-gray-900">New Deliverable</h4>
				<form method="POST" action="{actionBase}?/createDeliverable" use:enhance class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="new-deliverable-name" class="block text-sm font-medium text-gray-700">Name</label>
							<input
								id="new-deliverable-name"
								name="name"
								type="text"
								required
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="Development Work"
							/>
						</div>
						<div>
							<label for="new-deliverable-order" class="block text-sm font-medium text-gray-700">Sort Order</label>
							<input
								id="new-deliverable-order"
								name="sort_order"
								type="number"
								value="0"
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							/>
						</div>
					</div>
					<div class="flex justify-end">
						<button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Create Deliverable</button>
					</div>
				</form>
			</div>
		{/if}

		{#if data.deliverables.length === 0}
			<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
				<p class="text-gray-500">No deliverables yet. Add a deliverable to this contract.</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each data.deliverables as deliverable (deliverable.id)}
					<DeliverableCard {deliverable} {actionBase} />
				{/each}
			</div>
		{/if}
	</div>
</div>
