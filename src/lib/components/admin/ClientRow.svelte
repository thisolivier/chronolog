<script lang="ts">
	import { enhance } from '$app/forms';

	let { client } = $props();

	let isEditing = $state(false);
	let editName = $state(client.name);
	let editShortCode = $state(client.shortCode);
	let isDeleting = $state(false);
</script>

{#if isEditing}
	<tr class="bg-blue-50">
		<td class="px-6 py-3" colspan="3">
			<form
				method="POST"
				action="/admin/clients?/update"
				use:enhance={() => {
					return async ({ update }) => {
						isEditing = false;
						await update();
					};
				}}
				class="flex items-center gap-4"
			>
				<input type="hidden" name="client_id" value={client.id} />
				<input
					name="name"
					type="text"
					required
					bind:value={editName}
					class="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				<input
					name="short_code"
					type="text"
					required
					bind:value={editShortCode}
					class="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				<div class="ml-auto flex gap-2">
					<button
						type="submit"
						class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
					>
						Save
					</button>
					<button
						type="button"
						onclick={() => {
							isEditing = false;
							editName = client.name;
							editShortCode = client.shortCode;
						}}
						class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
				</div>
			</form>
		</td>
	</tr>
{:else}
	<tr class="hover:bg-gray-50">
		<td class="px-6 py-4 text-sm font-medium text-gray-900">
			<a
				href="/admin/clients/{client.id}"
				class="text-blue-600 hover:text-blue-800 hover:underline"
			>
				{client.name}
			</a>
		</td>
		<td class="px-6 py-4 text-sm text-gray-500">
			<span class="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{client.shortCode}</span>
		</td>
		<td class="px-6 py-4 text-right text-sm">
			<div class="flex items-center justify-end gap-2">
				<button
					onclick={() => (isEditing = true)}
					class="text-gray-500 hover:text-blue-600"
				>
					Edit
				</button>
				{#if isDeleting}
					<form method="POST" action="/admin/clients?/delete" use:enhance class="inline">
						<input type="hidden" name="client_id" value={client.id} />
						<button type="submit" class="text-red-600 font-medium hover:text-red-800">
							Confirm
						</button>
					</form>
					<button
						onclick={() => (isDeleting = false)}
						class="text-gray-500 hover:text-gray-700"
					>
						Cancel
					</button>
				{:else}
					<button
						onclick={() => (isDeleting = true)}
						class="text-red-500 hover:text-red-700"
					>
						Delete
					</button>
				{/if}
			</div>
		</td>
	</tr>
{/if}
