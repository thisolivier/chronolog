<script lang="ts">
	import { untrack } from 'svelte';
	import { getDataService } from '$lib/services/context';

	interface ClientOption {
		id: string;
		name: string;
		shortCode: string;
	}

	interface Props {
		clients: ClientOption[];
		/** The client being viewed: preselected so the contract lands where you are */
		initialClientId?: string | null;
		onCreated: (created?: { id: string; clientId: string }) => void;
		onClose: () => void;
	}

	/** Select value meaning "create a new client inline" (sprint 026-CL, finding 31). */
	const NEW_CLIENT = '__new__';

	const dataService = getDataService();

	let { clients, initialClientId = null, onCreated, onClose }: Props = $props();

	let contractName = $state('');
	let contractDescription = $state('');
	let isActive = $state(true);
	let isSubmitting = $state(false);
	let submitError = $state('');

	// With no clients yet, start straight on the inline new-client fields
	let selectedClientId = $state(
		untrack(() =>
			clients.length === 0
				? NEW_CLIENT
				: initialClientId && clients.some((client) => client.id === initialClientId)
					? initialClientId
					: ''
		)
	);
	let newClientName = $state('');
	let newClientShortCode = $state('');
	const isCreatingClient = $derived(selectedClientId === NEW_CLIENT);
	const canSubmit = $derived(
		Boolean(contractName.trim()) &&
			(isCreatingClient ? Boolean(newClientName.trim() && newClientShortCode.trim()) : Boolean(selectedClientId))
	);

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!canSubmit) return;

		isSubmitting = true;
		submitError = '';

		try {
			const created = await dataService.createContract({
				...(isCreatingClient
					? { newClient: { name: newClientName.trim(), shortCode: newClientShortCode.trim() } }
					: { clientId: selectedClientId }),
				name: contractName.trim(),
				description: contractDescription.trim() || null,
				isActive
			});

			onCreated(created);
		} catch (error) {
			submitError = readableError(error);
		} finally {
			isSubmitting = false;
		}
	}

	/** The API answers `{ message }` bodies; show that text rather than the raw request line. */
	function readableError(error: unknown): string {
		const raw = error instanceof Error ? error.message : '';
		const bodyStart = raw.indexOf('{');
		if (bodyStart !== -1) {
			try {
				return JSON.parse(raw.slice(bodyStart)).message ?? raw;
			} catch {
				/* fall through */
			}
		}
		return raw || 'Couldn’t create the contract.';
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
	<div class="mx-4 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
		<div class="border-b border-stone-200 px-6 py-4">
			<h2 class="text-lg font-semibold text-stone-900">New Contract</h2>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4 px-6 py-4">
			<!-- Client select -->
			<div>
				<label for="client-select" class="mb-1 block text-sm font-medium text-stone-700">
					Client
				</label>
				<select
					id="client-select"
					bind:value={selectedClientId}
					required
					class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				>
					<option value="">Select a client...</option>
					{#each clients as client (client.id)}
						<option value={client.id}>{client.name}</option>
					{/each}
					<option value={NEW_CLIENT}>+ New client…</option>
				</select>
			</div>

			{#if isCreatingClient}
				<div class="grid grid-cols-3 gap-3 rounded-md bg-stone-50 p-3">
					<div class="col-span-2">
						<label for="new-client-name" class="mb-1 block text-sm font-medium text-stone-700">Client name</label>
						<input
							id="new-client-name"
							type="text"
							bind:value={newClientName}
							required
							placeholder="Acme Corp"
							class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label for="new-client-code" class="mb-1 block text-sm font-medium text-stone-700">Short code</label>
						<input
							id="new-client-code"
							type="text"
							bind:value={newClientShortCode}
							required
							placeholder="ACME"
							class="w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>
					<p class="col-span-3 text-xs text-stone-500">The short code prefixes note IDs, e.g. ACME.20261103.001.</p>
				</div>
			{/if}

			<!-- Contract name -->
			<div>
				<label for="contract-name" class="mb-1 block text-sm font-medium text-stone-700">
					Name
				</label>
				<input
					id="contract-name"
					type="text"
					bind:value={contractName}
					required
					placeholder="Contract name"
					class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="contract-description" class="mb-1 block text-sm font-medium text-stone-700">
					Description
				</label>
				<textarea
					id="contract-description"
					bind:value={contractDescription}
					rows={3}
					placeholder="Optional description"
					class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				></textarea>
			</div>

			<!-- Active toggle -->
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={isActive} class="rounded border-stone-300" />
				<span class="text-sm text-stone-700">Active</span>
			</label>

			{#if submitError}
				<div class="rounded-md bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
			{/if}

			<!-- Actions -->
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={onClose}
					class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSubmitting || !canSubmit}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSubmitting ? 'Creating...' : 'Create'}
				</button>
			</div>
		</form>
	</div>
</div>
