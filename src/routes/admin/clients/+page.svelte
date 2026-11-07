<script lang="ts">
	import { enhance } from '$app/forms';
	import ClientRow from '$lib/components/admin/ClientRow.svelte';
	import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';
	import FormFeedback from '$lib/components/admin/FormFeedback.svelte';
	import { closeOnSuccess, escapeCancels } from '$lib/components/admin/form-enhancers';
	import { CLIENT_COLORS, findSharedClientColors, suggestClientColorIndex } from '$lib/utils/client-colors';

	let { data, form } = $props();

	let showCreateForm = $state(false);

	// Active clients first, archived ones after (each group keeps name order from the server)
	const orderedClients = $derived([
		...data.clients.filter((client) => client.archivedAt === null),
		...data.clients.filter((client) => client.archivedAt !== null)
	]);

	const activeClients = $derived(data.clients.filter((client) => client.archivedAt === null));

	// Default a new client to the first palette colour no active client uses, so clients differ by default
	const suggestedColorIndex = $derived(suggestClientColorIndex(activeClients.map((client) => client.colorIndex)));

	// Active clients that share a colour: a hint, existing colours are never changed for the user
	const sharedColors = $derived(findSharedClientColors(data.clients));

	function listNames(names: string[]): string {
		return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
	}
</script>

<svelte:head><title>Chronolog · Settings · Clients</title></svelte:head>

<div class="space-y-6">
	<AdminBreadcrumb items={[{ label: 'Clients' }]} />

	<div class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-ink">Clients</h1>
			<p class="mt-1 text-sm text-ink-muted">Manage your consulting clients.</p>
		</div>
		{#if !showCreateForm}
			<button
				onclick={() => (showCreateForm = true)}
				class="rounded-md btn-primary px-4 py-2 text-sm font-medium"
			>
				Add Client
			</button>
		{/if}
	</div>

	<FormFeedback {form} />

	{#if sharedColors.length > 0}
		<div class="rounded-md border border-ochre-200 bg-ochre-50 px-4 py-3 text-sm text-ochre-900" data-testid="shared-colour-hint">
			<p class="font-medium">Some active clients share a colour, so they look alike in the timesheet and sidebar.</p>
			<ul class="mt-1 list-disc pl-5">
				{#each sharedColors as shared (shared.colorIndex)}
					<li>{listNames(shared.clientNames)} share {shared.colorName}.</li>
				{/each}
			</ul>
			<p class="mt-1">Pick another colour with Edit on one of them.</p>
		</div>
	{/if}

	{#if showCreateForm}
		<div class="rounded-lg border border-divider bg-surface p-6 shadow-sm">
			<h2 class="mb-4 text-lg font-medium text-ink">New Client</h2>
			<form
				method="POST"
				action="?/create"
				use:enhance={closeOnSuccess(() => (showCreateForm = false))}
				use:escapeCancels={() => (showCreateForm = false)}
				class="space-y-4"
			>
				<div class="grid gap-4 sm:grid-cols-4">
					<div>
						<label for="new-client-name" class="block text-sm font-medium text-ink-soft">
							Name
						</label>
						<input
							id="new-client-name"
							name="name"
							type="text"
							required
							value={form?.name ?? ''}
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
							placeholder="Acme Corporation"
						/>
					</div>
					<div>
						<label for="new-client-code" class="block text-sm font-medium text-ink-soft">
							Short Code
						</label>
						<input
							id="new-client-code"
							name="short_code"
							type="text"
							required
							value={form?.shortCode ?? ''}
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
							placeholder="ACME"
						/>
					</div>
					<div>
						<label for="new-client-emoji" class="block text-sm font-medium text-ink-soft">
							Emoji
						</label>
						<input
							id="new-client-emoji"
							name="emoji"
							type="text"
							class="mt-1 block w-full rounded-md input-base px-3 py-2"
							placeholder=""
						/>
					</div>
					<div>
						<label for="new-client-color" class="block text-sm font-medium text-ink-soft">
							Colour
						</label>
						<select
							id="new-client-color"
							name="color_index"
							value={suggestedColorIndex}
							class="mt-1 block w-full rounded-md input-base bg-surface px-3 py-2"
						>
							{#each CLIENT_COLORS as color, colorIndex (colorIndex)}
								<option value={colorIndex}>{color.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={() => (showCreateForm = false)}
						class="rounded-md btn-secondary px-4 py-2 text-sm"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-md btn-primary px-4 py-2 text-sm font-medium"
					>
						Create Client
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.clients.length === 0}
		<div class="rounded-lg border border-divider bg-surface p-8 text-center shadow-sm">
			<p class="text-ink-faint">No clients yet. Add your first client to get started.</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-divider bg-surface shadow-sm">
			<!-- stack-table (app.css): one block per client below 640px, actions in view (sprint 047-QA) -->
			<table class="stack-table min-w-full divide-y divide-divider">
				<thead class="bg-chalk-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-faint">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-faint">
							Short Code
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-faint">
							Emoji
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-faint">
							Colour
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-ink-faint">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-divider">
					{#each orderedClients as client (client.id)}
						<ClientRow {client} />
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
