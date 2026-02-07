<script lang="ts">
	import { enhance } from '$app/forms';

	interface ContractData {
		id: string;
		name: string;
		description: string | null;
		isActive: boolean;
	}

	let { contract, clientId }: { contract: ContractData; clientId: string } = $props();

	let isEditing = $state(false);
	let isDeleting = $state(false);
	let editName = $state(contract.name);
	let editDescription = $state(contract.description || '');
	let editIsActive = $state(contract.isActive);
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	{#if isEditing}
		<form
			method="POST"
			action="/admin/clients/{clientId}?/updateContract"
			use:enhance={() => {
				return async ({ update }) => {
					isEditing = false;
					await update();
				};
			}}
			class="space-y-3"
		>
			<input type="hidden" name="contract_id" value={contract.id} />
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label for="edit-contract-name-{contract.id}" class="block text-sm font-medium text-gray-700">Name</label>
					<input
						id="edit-contract-name-{contract.id}"
						name="name"
						type="text"
						required
						bind:value={editName}
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					/>
				</div>
				<div>
					<label for="edit-contract-desc-{contract.id}" class="block text-sm font-medium text-gray-700">Description</label>
					<input
						id="edit-contract-desc-{contract.id}"
						name="description"
						type="text"
						bind:value={editDescription}
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					/>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<input
					id="edit-contract-active-{contract.id}"
					name="is_active"
					type="checkbox"
					bind:checked={editIsActive}
					class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
				/>
				<label for="edit-contract-active-{contract.id}" class="text-sm text-gray-700">Active</label>
			</div>
			<div class="flex gap-2">
				<button type="submit" class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
					Save
				</button>
				<button
					type="button"
					onclick={() => {
						isEditing = false;
						editName = contract.name;
						editDescription = contract.description || '';
						editIsActive = contract.isActive;
					}}
					class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
			</div>
		</form>
	{:else}
		<div class="flex items-center justify-between">
			<div>
				<a
					href="/admin/clients/{clientId}/contracts/{contract.id}"
					class="font-medium text-blue-600 hover:text-blue-800 hover:underline"
				>
					{contract.name}
				</a>
				{#if contract.description}
					<p class="mt-0.5 text-sm text-gray-500">{contract.description}</p>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {contract.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
					{contract.isActive ? 'Active' : 'Inactive'}
				</span>
				<button onclick={() => (isEditing = true)} class="text-sm text-gray-500 hover:text-blue-600">
					Edit
				</button>
				{#if isDeleting}
					<form method="POST" action="/admin/clients/{clientId}?/deleteContract" use:enhance class="inline">
						<input type="hidden" name="contract_id" value={contract.id} />
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
