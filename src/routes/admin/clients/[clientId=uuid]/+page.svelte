<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ContractRow from '$lib/components/admin/ContractRow.svelte';
	import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';
	import FormFeedback from '$lib/components/admin/FormFeedback.svelte';
	import { escapeCancels, closeOnSuccess } from '$lib/components/admin/form-enhancers';

	let { data, form } = $props();

	let isEditingClient = $state(false);
	let showCreateContractForm = $state(false);
	let reorderMessage = $state<{ error?: string; message?: string } | null>(null);

	// A form result replaces any earlier reorder message
	$effect(() => {
		if (form) reorderMessage = null;
	});

	// Active contracts in manual order (server sorts by sortOrder, then name); archived ones after.
	const activeContracts = $derived(data.contracts.filter((contract) => contract.archivedAt === null));
	const archivedContracts = $derived(data.contracts.filter((contract) => contract.archivedAt !== null));

	/** Swap a contract with its neighbour and persist the whole order (BACKLOG Task 13). */
	async function moveContract(index: number, direction: -1 | 1) {
		const orderedIds = activeContracts.map((contract) => contract.id);
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= orderedIds.length) return;
		[orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];

		const movedName = activeContracts[index].name;
		try {
			const response = await fetch('/api/contracts/reorder', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orderedIds })
			});
			if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? response.statusText);
			reorderMessage = { message: `Moved “${movedName}” ${direction < 0 ? 'up' : 'down'}. The sidebar uses this order.` };
		} catch (reorderError) {
			reorderMessage = { error: `Couldn’t save the new order: ${reorderError instanceof Error ? reorderError.message : 'network error'}.` };
		}
		await invalidateAll();
	}
</script>

<svelte:head><title>Chronolog · Settings · {data.client.name}</title></svelte:head>

<div class="space-y-6">
	<AdminBreadcrumb
		items={[
			{ label: 'Clients', href: '/admin/clients' },
			{ label: data.client.name }
		]}
	/>

	<FormFeedback form={reorderMessage ?? form} />

	<!-- Client Header -->
	<div class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
		{#if isEditingClient}
			<form
				method="POST"
				action="?/updateClient"
				use:enhance={closeOnSuccess(() => (isEditingClient = false))}
				use:escapeCancels={() => (isEditingClient = false)}
				class="space-y-4"
			>
				<h2 class="text-lg font-medium text-stone-900">Edit Client</h2>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="edit-client-name" class="block text-sm font-medium text-stone-700">
							Name
						</label>
						<input
							id="edit-client-name"
							name="name"
							type="text"
							required
							value={data.client.name}
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
						/>
					</div>
					<div>
						<label for="edit-client-code" class="block text-sm font-medium text-stone-700">
							Short Code
						</label>
						<input
							id="edit-client-code"
							name="short_code"
							type="text"
							required
							value={data.client.shortCode}
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
						/>
					</div>
				</div>
				<div class="flex justify-end gap-2">
					<button type="button" onclick={() => (isEditingClient = false)} class="rounded-md btn-secondary px-4 py-2 text-sm">
						Cancel
					</button>
					<button type="submit" class="rounded-md btn-primary px-4 py-2 text-sm font-medium">
						Save
					</button>
				</div>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-xl font-semibold text-stone-900">{data.client.name}</h2>
					<p class="mt-1 text-sm text-stone-500">
						Code: <span class="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs">{data.client.shortCode}</span>
					</p>
				</div>
				<button
					onclick={() => (isEditingClient = true)}
					class="rounded-md btn-secondary px-3 py-1.5 text-sm"
				>
					Edit Client
				</button>
			</div>
		{/if}
	</div>

	<!-- Contracts Section -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-medium text-stone-900">Contracts</h3>
			{#if !showCreateContractForm}
				<button
					onclick={() => (showCreateContractForm = true)}
					class="rounded-md btn-primary px-4 py-2 text-sm font-medium"
				>
					Add Contract
				</button>
			{/if}
		</div>

		{#if showCreateContractForm}
			<div class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
				<h4 class="mb-4 text-base font-medium text-stone-900">New Contract</h4>
				<form
					method="POST"
					action="?/createContract"
					use:enhance={closeOnSuccess(() => (showCreateContractForm = false))}
					use:escapeCancels={() => (showCreateContractForm = false)}
					class="space-y-4"
				>
					<div>
						<label for="new-contract-name" class="block text-sm font-medium text-stone-700">
							Name
						</label>
						<input
							id="new-contract-name"
							name="name"
							type="text"
							required
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
							placeholder="Q1 2025 Consulting"
						/>
					</div>
					<div>
						<label for="new-contract-description" class="block text-sm font-medium text-stone-700">
							Description
						</label>
						<textarea
							id="new-contract-description"
							name="description"
							rows="2"
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
							placeholder="Optional description"
						></textarea>
					</div>
					<div class="flex items-center gap-2">
						<input id="new-contract-active" name="is_active" type="checkbox" checked class="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500" />
						<label for="new-contract-active" class="text-sm text-stone-700">Active</label>
					</div>
					<div class="flex justify-end gap-2">
						<button type="button" onclick={() => (showCreateContractForm = false)} class="rounded-md btn-secondary px-4 py-2 text-sm">
							Cancel
						</button>
						<button type="submit" class="rounded-md btn-primary px-4 py-2 text-sm font-medium">
							Create Contract
						</button>
					</div>
				</form>
			</div>
		{/if}

		{#if data.contracts.length === 0}
			<div class="rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm">
				<p class="text-stone-500">No contracts yet. Add a contract to this client.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each activeContracts as contract, index (contract.id)}
					<ContractRow
						{contract}
						clientId={data.client.id}
						clientName={data.client.name}
						onMove={(direction) => moveContract(index, direction)}
						canMoveUp={index > 0}
						canMoveDown={index < activeContracts.length - 1}
					/>
				{/each}
			</div>
			{#if archivedContracts.length > 0}
				<h4 class="pt-2 text-xs font-semibold uppercase text-stone-400">Archived</h4>
				<div class="space-y-2">
					{#each archivedContracts as contract (contract.id)}
						<ContractRow {contract} clientId={data.client.id} clientName={data.client.name} canMoveUp={false} canMoveDown={false} />
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
