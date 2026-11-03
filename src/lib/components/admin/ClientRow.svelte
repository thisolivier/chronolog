<script lang="ts">
	import { enhance } from '$app/forms';
	import { CLIENT_COLORS, getClientDotClass } from '$lib/utils/client-colors';

	let { client } = $props();

	let isEditing = $state(false);
	let editName = $state(client.name);
	let editShortCode = $state(client.shortCode);
	let editEmoji = $state(client.emoji ?? '');
	let editColorIndex = $state(client.colorIndex ?? 0);
	let isDeleting = $state(false);

	const colorName = $derived(
		CLIENT_COLORS[(client.colorIndex ?? 0) % CLIENT_COLORS.length].name
	);

	function resetEditFields(): void {
		editName = client.name;
		editShortCode = client.shortCode;
		editEmoji = client.emoji ?? '';
		editColorIndex = client.colorIndex ?? 0;
	}
</script>

{#if isEditing}
	<tr class="bg-blue-50">
		<td class="px-6 py-3" colspan="5">
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
					class="rounded-md border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				<input
					name="short_code"
					type="text"
					required
					bind:value={editShortCode}
					class="w-24 rounded-md border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				<input
					name="emoji"
					type="text"
					bind:value={editEmoji}
					class="w-16 rounded-md border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder=""
				/>
				<label class="flex items-center gap-2 text-sm text-stone-700">
					<span
						class="inline-block h-3 w-3 flex-shrink-0 rounded-full {getClientDotClass(editColorIndex)}"
						aria-hidden="true"
					></span>
					<select
						name="color_index"
						bind:value={editColorIndex}
						aria-label="Client colour"
						class="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					>
						{#each CLIENT_COLORS as color, colorIndex (colorIndex)}
							<option value={colorIndex}>{color.name}</option>
						{/each}
					</select>
				</label>
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
							resetEditFields();
						}}
						class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
					>
						Cancel
					</button>
				</div>
			</form>
		</td>
	</tr>
{:else}
	<tr class="hover:bg-stone-50" data-client-id={client.id}>
		<td class="px-6 py-4 text-sm font-medium text-stone-900">
			<span class="flex items-center gap-2">
				<span
					class="inline-block h-2 w-2 flex-shrink-0 rounded-full {getClientDotClass(client.colorIndex ?? 0)}"
					aria-hidden="true"
				></span>
				<a
					href="/admin/clients/{client.id}"
					class="text-blue-600 hover:text-blue-800 hover:underline"
				>
					{client.name}
				</a>
			</span>
		</td>
		<td class="px-6 py-4 text-sm text-stone-500">
			<span class="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs">{client.shortCode}</span>
		</td>
		<td class="px-6 py-4 text-sm">
			{client.emoji ?? ''}
		</td>
		<td class="px-6 py-4 text-sm text-stone-600">
			<span class="flex items-center gap-2" data-client-color-index={client.colorIndex ?? 0}>
				<span
					class="inline-block h-3 w-3 flex-shrink-0 rounded-full {getClientDotClass(client.colorIndex ?? 0)}"
					aria-hidden="true"
				></span>
				{colorName}
			</span>
		</td>
		<td class="px-6 py-4 text-right text-sm">
			<div class="flex items-center justify-end gap-2">
				<button
					onclick={() => {
						resetEditFields();
						isEditing = true;
					}}
					class="text-stone-500 hover:text-blue-600"
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
						class="text-stone-500 hover:text-stone-700"
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
