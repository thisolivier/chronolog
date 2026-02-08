<script lang="ts">
	import { enhance } from '$app/forms';
	import ClientRow from '$lib/components/admin/ClientRow.svelte';

	let { data, form } = $props();

	let showCreateForm = $state(false);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-gray-900">Clients</h1>
			<p class="mt-1 text-sm text-gray-600">Manage your consulting clients.</p>
		</div>
		<button
			onclick={() => (showCreateForm = !showCreateForm)}
			class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
		>
			{showCreateForm ? 'Cancel' : 'Add Client'}
		</button>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-md bg-green-50 p-4 text-sm text-green-700">
			Operation completed successfully.
		</div>
	{/if}

	{#if showCreateForm}
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-lg font-medium text-gray-900">New Client</h2>
			<form method="POST" action="?/create" use:enhance class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<label for="new-client-name" class="block text-sm font-medium text-gray-700">
							Name
						</label>
						<input
							id="new-client-name"
							name="name"
							type="text"
							required
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							placeholder="Acme Corporation"
						/>
					</div>
					<div>
						<label for="new-client-code" class="block text-sm font-medium text-gray-700">
							Short Code
						</label>
						<input
							id="new-client-code"
							name="short_code"
							type="text"
							required
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							placeholder="ACME"
						/>
					</div>
					<div>
						<label for="new-client-emoji" class="block text-sm font-medium text-gray-700">
							Emoji
						</label>
						<input
							id="new-client-emoji"
							name="emoji"
							type="text"
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							placeholder="🏢"
						/>
					</div>
				</div>
				<div class="flex justify-end">
					<button
						type="submit"
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
					>
						Create Client
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.clients.length === 0}
		<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
			<p class="text-gray-500">No clients yet. Add your first client to get started.</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
							Short Code
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
							Emoji
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200">
					{#each data.clients as client (client.id)}
						<ClientRow {client} />
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
