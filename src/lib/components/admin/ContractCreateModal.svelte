<script lang="ts">
	import { getDataService } from '$lib/services/context';

	interface ClientOption {
		id: string;
		name: string;
		shortCode: string;
	}

	interface Props {
		clients: ClientOption[];
		onCreated: () => void;
		onClose: () => void;
	}

	const dataService = getDataService();

	let { clients, onCreated, onClose }: Props = $props();

	let selectedClientId = $state('');
	let contractName = $state('');
	let contractDescription = $state('');
	let isActive = $state(true);
	let isSubmitting = $state(false);
	let submitError = $state('');

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!selectedClientId || !contractName.trim()) return;

		isSubmitting = true;
		submitError = '';

		try {
			await dataService.createContract({
				clientId: selectedClientId,
				name: contractName.trim(),
				description: contractDescription.trim() || null,
				isActive
			});

			onCreated();
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Failed to create contract';
		} finally {
			isSubmitting = false;
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	onclick={handleBackdropClick}
	onkeydown={(event) => event.key === 'Escape' && onClose()}
	role="dialog"
	aria-modal="true"
	aria-label="Create new contract"
>
	<div class="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
		<div class="border-b border-gray-200 px-6 py-4">
			<h2 class="text-lg font-semibold text-gray-900">New Contract</h2>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4 px-6 py-4">
			<!-- Client select -->
			<div>
				<label for="client-select" class="mb-1 block text-sm font-medium text-gray-700">
					Client
				</label>
				<select
					id="client-select"
					bind:value={selectedClientId}
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				>
					<option value="">Select a client...</option>
					{#each clients as client (client.id)}
						<option value={client.id}>{client.name}</option>
					{/each}
				</select>
			</div>

			<!-- Contract name -->
			<div>
				<label for="contract-name" class="mb-1 block text-sm font-medium text-gray-700">
					Name
				</label>
				<input
					id="contract-name"
					type="text"
					bind:value={contractName}
					required
					placeholder="Contract name"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="contract-description" class="mb-1 block text-sm font-medium text-gray-700">
					Description
				</label>
				<textarea
					id="contract-description"
					bind:value={contractDescription}
					rows={3}
					placeholder="Optional description"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				></textarea>
			</div>

			<!-- Active toggle -->
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={isActive} class="rounded border-gray-300" />
				<span class="text-sm text-gray-700">Active</span>
			</label>

			{#if submitError}
				<div class="rounded-md bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
			{/if}

			<!-- Actions -->
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={onClose}
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSubmitting || !selectedClientId || !contractName.trim()}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSubmitting ? 'Creating...' : 'Create'}
				</button>
			</div>
		</form>
	</div>
</div>
