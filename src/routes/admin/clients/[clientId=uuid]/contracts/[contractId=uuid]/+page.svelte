<script lang="ts">
	import { enhance } from '$app/forms';
	import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';
	import DeliverableCard from '$lib/components/admin/DeliverableCard.svelte';
	import FormFeedback from '$lib/components/admin/FormFeedback.svelte';
	import { escapeCancels, closeOnSuccess } from '$lib/components/admin/form-enhancers';

	let { data, form } = $props();

	let isEditingContract = $state(false);
	let showCreateDeliverableForm = $state(false);

	let actionBase = $derived(`/admin/clients/${data.client.id}/contracts/${data.contract.id}`);
</script>

<svelte:head><title>Chronolog · Settings · {data.contract.name}</title></svelte:head>

<div class="space-y-6">
	<AdminBreadcrumb
		items={[
			{ label: 'Clients', href: '/admin/clients' },
			{ label: data.client.name, href: `/admin/clients/${data.client.id}` },
			{ label: data.contract.name }
		]}
	/>

	<FormFeedback {form} />

	<!-- Contract Header -->
	<div class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
		{#if isEditingContract}
			<form
				method="POST"
				action="{actionBase}?/updateContract"
				use:enhance={closeOnSuccess(() => (isEditingContract = false))}
				use:escapeCancels={() => (isEditingContract = false)}
				class="space-y-4"
			>
				<h2 class="text-lg font-medium text-stone-900">Edit Contract</h2>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="edit-contract-name" class="block text-sm font-medium text-stone-700">Name</label>
						<input
							id="edit-contract-name"
							name="name"
							type="text"
							required
							value={data.contract.name}
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
						/>
					</div>
					<div>
						<label for="edit-contract-desc" class="block text-sm font-medium text-stone-700">Description</label>
						<input
							id="edit-contract-desc"
							name="description"
							type="text"
							value={data.contract.description || ''}
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
						/>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<input
						id="edit-contract-active"
						name="is_active"
						type="checkbox"
						checked={data.contract.isActive}
						class="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
					/>
					<label for="edit-contract-active" class="text-sm text-stone-700">Active</label>
				</div>
				<div class="flex justify-end gap-2">
					<button type="button" onclick={() => (isEditingContract = false)} class="rounded-md btn-secondary px-4 py-2 text-sm">Cancel</button>
					<button type="submit" class="rounded-md btn-primary px-4 py-2 text-sm font-medium">Save</button>
				</div>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<div>
					<div class="flex items-center gap-3">
						<h2 class="text-xl font-semibold text-stone-900">{data.contract.name}</h2>
						<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {data.contract.isActive ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-800'}">
							{data.contract.isActive ? 'Active' : 'Inactive'}
						</span>
					</div>
					{#if data.contract.description}
						<p class="mt-1 text-sm text-stone-500">{data.contract.description}</p>
					{/if}
				</div>
				<button
					onclick={() => (isEditingContract = true)}
					class="rounded-md btn-secondary px-3 py-1.5 text-sm"
				>
					Edit Contract
				</button>
			</div>
		{/if}
	</div>

	<!-- Deliverables Section -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-medium text-stone-900">Deliverables</h3>
			{#if !showCreateDeliverableForm}
				<button
					onclick={() => (showCreateDeliverableForm = true)}
					class="rounded-md btn-primary px-4 py-2 text-sm font-medium"
				>
					Add Deliverable
				</button>
			{/if}
		</div>

		{#if showCreateDeliverableForm}
			<div class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
				<h4 class="mb-4 text-base font-medium text-stone-900">New Deliverable</h4>
				<form
					method="POST"
					action="{actionBase}?/createDeliverable"
					use:enhance={closeOnSuccess(() => (showCreateDeliverableForm = false))}
					use:escapeCancels={() => (showCreateDeliverableForm = false)}
					class="space-y-4"
				>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="new-deliverable-name" class="block text-sm font-medium text-stone-700">Name</label>
							<input
								id="new-deliverable-name"
								name="name"
								type="text"
								required
								class="mt-1 block w-full rounded-md input-base px-3 py-2"
								placeholder="Development Work"
							/>
						</div>
						<div>
							<label for="new-deliverable-order" class="block text-sm font-medium text-stone-700">Sort Order</label>
							<input
								id="new-deliverable-order"
								name="sort_order"
								type="number"
								value="0"
								class="mt-1 block w-full rounded-md input-base px-3 py-2"
							/>
						</div>
					</div>
					<div class="flex justify-end gap-2">
						<button type="button" onclick={() => (showCreateDeliverableForm = false)} class="rounded-md btn-secondary px-4 py-2 text-sm">Cancel</button>
						<button type="submit" class="rounded-md btn-primary px-4 py-2 text-sm font-medium">Create Deliverable</button>
					</div>
				</form>
			</div>
		{/if}

		{#if data.deliverables.length === 0}
			<div class="rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm">
				<p class="text-stone-500">No deliverables yet. Add a deliverable to this contract.</p>
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
