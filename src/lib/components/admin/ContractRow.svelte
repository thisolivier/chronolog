<script lang="ts">
	import { enhance } from '$app/forms';
	import type { UsageSummaryInput } from '$lib/utils/usage-summary';
	import DeleteImpactDialog from './DeleteImpactDialog.svelte';
	import { escapeCancels, closeOnSuccess } from './form-enhancers';

	interface ContractData {
		id: string;
		name: string;
		description: string | null;
		isActive: boolean;
		archivedAt: Date | string | null;
		usage: UsageSummaryInput;
	}

	interface Props {
		contract: ContractData;
		clientId: string;
		clientName: string;
		/** Move one step up (-1) or down (+1) in the manual order; absent when it cannot move. */
		onMove?: (direction: -1 | 1) => void;
		canMoveUp: boolean;
		canMoveDown: boolean;
	}

	let { contract, clientId, clientName, onMove, canMoveUp, canMoveDown }: Props = $props();

	let isEditing = $state(false);
	let isConfirmingDelete = $state(false);
	let editName = $state('');
	let editDescription = $state('');
	let editIsActive = $state(true);

	const isArchived = $derived(contract.archivedAt !== null);
	const actionBase = $derived(`/admin/clients/${clientId}`);

	function startEditing() {
		editName = contract.name;
		editDescription = contract.description || '';
		editIsActive = contract.isActive;
		isEditing = true;
	}
	const cancelEditing = () => (isEditing = false);
	const inputClass =
		'mt-1 block w-full rounded-md input-base px-3 py-1.5 text-sm';
	const arrowClass =
		'flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:invisible';
</script>

<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm {isArchived ? 'bg-stone-50' : ''}" data-contract-id={contract.id}>
	{#if isEditing}
		<form
			method="POST"
			action="{actionBase}?/updateContract"
			use:enhance={closeOnSuccess(cancelEditing)}
			use:escapeCancels={cancelEditing}
			class="space-y-3"
		>
			<input type="hidden" name="contract_id" value={contract.id} />
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label for="edit-contract-name-{contract.id}" class="block text-sm font-medium text-stone-700">Name</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input id="edit-contract-name-{contract.id}" name="name" type="text" required autofocus bind:value={editName} class={inputClass} />
				</div>
				<div>
					<label for="edit-contract-desc-{contract.id}" class="block text-sm font-medium text-stone-700">Description</label>
					<input id="edit-contract-desc-{contract.id}" name="description" type="text" bind:value={editDescription} class={inputClass} />
				</div>
			</div>
			<div class="flex items-center gap-2">
				<input id="edit-contract-active-{contract.id}" name="is_active" type="checkbox" bind:checked={editIsActive} class="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500" />
				<label for="edit-contract-active-{contract.id}" class="text-sm text-stone-700">Active</label>
			</div>
			<div class="flex justify-end gap-2">
				<button type="button" onclick={cancelEditing} class="rounded-md btn-secondary px-3 py-1.5 text-sm">Cancel</button>
				<button type="submit" class="rounded-md btn-primary px-3 py-1.5 text-sm font-medium">Save</button>
			</div>
		</form>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-2">
				{#if onMove && !isArchived}
					<div class="flex flex-col" role="group" aria-label="Reorder {contract.name}">
						<button type="button" class={arrowClass} disabled={!canMoveUp} onclick={() => onMove(-1)} aria-label="Move {contract.name} up">▲</button>
						<button type="button" class={arrowClass} disabled={!canMoveDown} onclick={() => onMove(1)} aria-label="Move {contract.name} down">▼</button>
					</div>
				{/if}
				<div class="min-w-0">
					<a href="{actionBase}/contracts/{contract.id}" class="font-medium text-blue-600 hover:text-blue-800 hover:underline">{contract.name}</a>
					{#if contract.description}
						<p class="mt-0.5 text-sm text-stone-500">{contract.description}</p>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-3">
				{#if isArchived}
					<span class="inline-flex items-center rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-700">Archived</span>
				{:else}
					<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {contract.isActive ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-800'}">
						{contract.isActive ? 'Active' : 'Inactive'}
					</span>
				{/if}
				<button onclick={startEditing} class="text-sm text-stone-500 hover:text-blue-600 pointer-coarse:min-h-11">Edit</button>
				<!-- Direct Archive / Activate (sprint 041-CL); Delete still offers Archive too -->
				<form method="POST" action="{actionBase}?/{isArchived ? 'unarchiveContract' : 'archiveContract'}" use:enhance class="inline">
					<input type="hidden" name="contract_id" value={contract.id} />
					<button type="submit" aria-label="{isArchived ? 'Activate' : 'Archive'} {contract.name}" class="text-sm text-stone-500 hover:text-blue-600 pointer-coarse:min-h-11">{isArchived ? 'Activate' : 'Archive'}</button>
				</form>
				<button onclick={() => (isConfirmingDelete = true)} class="text-sm text-red-500 hover:text-red-700 pointer-coarse:min-h-11">Delete</button>
			</div>
		</div>
	{/if}
</div>

{#if isConfirmingDelete}
	<DeleteImpactDialog
		title="Delete contract “{contract.name}”?"
		usage={contract.usage}
		archiveAction={isArchived ? undefined : `${actionBase}?/archiveContract`}
		deleteAction="{actionBase}?/deleteContract"
		deleteConsequence="Delete and reassign removes the contract and its deliverables. Time entries move to “Deleted Client / Deleted Contract” with “Formerly: {clientName} / {contract.name}” added to their description, and notes move there too."
		hiddenFields={{ contract_id: contract.id }}
		onClose={() => (isConfirmingDelete = false)}
	/>
{/if}
