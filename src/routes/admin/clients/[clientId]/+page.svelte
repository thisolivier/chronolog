<script lang="ts">
	import { enhance } from '$app/forms';
	import ContractRow from '$lib/components/admin/ContractRow.svelte';
	import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';

	let { data, form } = $props();

	let isEditingClient = $state(false);
	let showCreateContractForm = $state(false);
</script>

<div class="space-y-6">
	<AdminBreadcrumb
		items={[
			{ label: 'Clients', href: '/admin/clients' },
			{ label: data.client.name }
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

	<!-- Client Header -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		{#if isEditingClient}
			<form method="POST" action="?/updateClient" use:enhance={() => {
				return async ({ update }) => {
					isEditingClient = false;
					await update();
				};
			}} class="space-y-4">
				<h2 class="text-lg font-medium text-gray-900">Edit Client</h2>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="edit-client-name" class="block text-sm font-medium text-gray-700">
							Name
						</label>
						<input
							id="edit-client-name"
							name="name"
							type="text"
							required
							value={data.client.name}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="edit-client-code" class="block text-sm font-medium text-gray-700">
							Short Code
						</label>
						<input
							id="edit-client-code"
							name="short_code"
							type="text"
							required
							value={data.client.shortCode}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
					</div>
				</div>
				<div class="flex gap-2">
					<button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
						Save
					</button>
					<button type="button" onclick={() => (isEditingClient = false)} class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
						Cancel
					</button>
				</div>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-xl font-semibold text-gray-900">{data.client.name}</h2>
					<p class="mt-1 text-sm text-gray-500">
						Code: <span class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{data.client.shortCode}</span>
					</p>
				</div>
				<button
					onclick={() => (isEditingClient = true)}
					class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Edit Client
				</button>
			</div>
		{/if}
	</div>

	<!-- Contracts Section -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-medium text-gray-900">Contracts</h3>
			<button
				onclick={() => (showCreateContractForm = !showCreateContractForm)}
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
			>
				{showCreateContractForm ? 'Cancel' : 'Add Contract'}
			</button>
		</div>

		{#if showCreateContractForm}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<h4 class="mb-4 text-base font-medium text-gray-900">New Contract</h4>
				<form method="POST" action="?/createContract" use:enhance class="space-y-4">
					<div>
						<label for="new-contract-name" class="block text-sm font-medium text-gray-700">
							Name
						</label>
						<input
							id="new-contract-name"
							name="name"
							type="text"
							required
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							placeholder="Q1 2025 Consulting"
						/>
					</div>
					<div>
						<label for="new-contract-description" class="block text-sm font-medium text-gray-700">
							Description
						</label>
						<textarea
							id="new-contract-description"
							name="description"
							rows="2"
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							placeholder="Optional description"
						></textarea>
					</div>
					<div class="flex items-center gap-2">
						<input id="new-contract-active" name="is_active" type="checkbox" checked class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
						<label for="new-contract-active" class="text-sm text-gray-700">Active</label>
					</div>
					<div class="flex justify-end">
						<button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
							Create Contract
						</button>
					</div>
				</form>
			</div>
		{/if}

		{#if data.contracts.length === 0}
			<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
				<p class="text-gray-500">No contracts yet. Add a contract to this client.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.contracts as contract (contract.id)}
					<ContractRow {contract} clientId={data.client.id} />
				{/each}
			</div>
		{/if}
	</div>
</div>
