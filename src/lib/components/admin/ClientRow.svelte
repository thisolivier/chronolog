<script lang="ts">
	import { enhance } from '$app/forms';
	import { CLIENT_COLORS, getClientDotClass } from '$lib/utils/client-colors';
	import type { UsageSummaryInput } from '$lib/utils/usage-summary';
	import DeleteImpactDialog from './DeleteImpactDialog.svelte';
	import { escapeCancels, closeOnSuccess } from './form-enhancers';

	interface ClientData {
		id: string;
		name: string;
		shortCode: string;
		emoji: string | null;
		colorIndex: number;
		archivedAt: Date | string | null;
		usage: UsageSummaryInput;
	}

	let { client }: { client: ClientData } = $props();

	let isEditing = $state(false);
	let isConfirmingDelete = $state(false);
	let editName = $state('');
	let editShortCode = $state('');
	let editEmoji = $state('');
	let editColorIndex = $state(0);

	const editFormId = $derived(`edit-client-${client.id}`);
	const isArchived = $derived(client.archivedAt !== null);
	const colorName = $derived(CLIENT_COLORS[(client.colorIndex ?? 0) % CLIENT_COLORS.length].name);

	function startEditing(): void {
		editName = client.name;
		editShortCode = client.shortCode;
		editEmoji = client.emoji ?? '';
		editColorIndex = client.colorIndex ?? 0;
		isEditing = true;
	}

	const cancelEditing = () => (isEditing = false);
	const inputClass =
		'w-full rounded-md border border-stone-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';
</script>

{#if isEditing}
	<!-- Inputs sit in the same cells as the values they edit; they join the form via `form=`. -->
	<tr class="bg-blue-50" use:escapeCancels={cancelEditing}>
		<td class="px-6 py-2" data-stack-full>
			<!-- svelte-ignore a11y_autofocus -->
			<input form={editFormId} name="name" type="text" required aria-label="Client name" autofocus bind:value={editName} class={inputClass} />
		</td>
		<td class="px-6 py-2" data-stack-full>
			<input form={editFormId} name="short_code" type="text" required aria-label="Short code" placeholder="Short code" bind:value={editShortCode} class="{inputClass} max-w-28 font-mono" />
		</td>
		<td class="px-6 py-2" data-stack-full>
			<input form={editFormId} name="emoji" type="text" aria-label="Emoji" placeholder="Emoji" bind:value={editEmoji} class="{inputClass} max-w-16" />
		</td>
		<td class="px-6 py-2" data-stack-full>
			<span class="flex items-center gap-2">
				<span class="inline-block h-3 w-3 flex-shrink-0 rounded-full {getClientDotClass(editColorIndex)}" aria-hidden="true"></span>
				<select form={editFormId} name="color_index" bind:value={editColorIndex} aria-label="Client colour" class="{inputClass} bg-white">
					{#each CLIENT_COLORS as color, colorIndex (colorIndex)}
						<option value={colorIndex}>{color.name}</option>
					{/each}
				</select>
			</span>
		</td>
		<td class="px-6 py-2 text-right" data-stack-full>
			<form id={editFormId} method="POST" action="/admin/clients?/update" use:enhance={closeOnSuccess(cancelEditing)} class="flex justify-end gap-2">
				<input type="hidden" name="client_id" value={client.id} />
				<button type="button" onclick={cancelEditing} class="rounded-md border border-stone-300 bg-white px-3 py-1 text-sm text-stone-700 hover:bg-stone-50">Cancel</button>
				<button type="submit" class="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">Save</button>
			</form>
		</td>
	</tr>
{:else}
	<tr class="hover:bg-stone-50 {isArchived ? 'text-stone-400' : ''}" data-client-id={client.id}>
		<td class="px-6 py-3 text-sm font-medium text-stone-900" data-stack-full>
			<span class="flex items-center gap-2">
				<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full {getClientDotClass(client.colorIndex ?? 0)}" aria-hidden="true"></span>
				<a href="/admin/clients/{client.id}" class="text-blue-600 hover:text-blue-800 hover:underline {isArchived ? 'opacity-60' : ''}">{client.name}</a>
				{#if isArchived}
					<span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-600">Archived</span>
				{/if}
			</span>
		</td>
		<td class="px-6 py-3 text-sm text-stone-500">
			<span class="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs">{client.shortCode}</span>
		</td>
		<td class="px-6 py-3 text-sm">{client.emoji ?? ''}</td>
		<td class="px-6 py-3 text-sm text-stone-600">
			<span class="flex items-center gap-2" data-client-color-index={client.colorIndex ?? 0}>
				<span class="inline-block h-3 w-3 flex-shrink-0 rounded-full {getClientDotClass(client.colorIndex ?? 0)}" aria-hidden="true"></span>
				{colorName}
			</span>
		</td>
		<td class="px-6 py-3 text-right text-sm" data-stack-full>
			<div class="flex items-center justify-end gap-3">
				<button onclick={startEditing} class="text-stone-500 hover:text-blue-600 pointer-coarse:min-h-11">Edit</button>
				<!-- Direct Archive / Activate (sprint 041-CL); Delete still offers Archive too -->
				<form method="POST" action="/admin/clients?/{isArchived ? 'unarchive' : 'archive'}" use:enhance class="inline">
					<input type="hidden" name="client_id" value={client.id} />
					<button type="submit" aria-label="{isArchived ? 'Activate' : 'Archive'} {client.name}" class="text-stone-500 hover:text-blue-600 pointer-coarse:min-h-11">{isArchived ? 'Activate' : 'Archive'}</button>
				</form>
				<button onclick={() => (isConfirmingDelete = true)} class="text-red-500 hover:text-red-700 pointer-coarse:min-h-11">Delete</button>
			</div>
			{#if isConfirmingDelete}
				<DeleteImpactDialog
					title="Delete client “{client.name}”?"
					usage={client.usage}
					archiveAction={isArchived ? undefined : '/admin/clients?/archive'}
					deleteAction="/admin/clients?/delete"
					deleteConsequence="Delete and reassign removes the client and its contracts. Time entries move to “Deleted Client / Deleted Contract” with a “Formerly: {client.name} / …” line, and notes move there too."
					hiddenFields={{ client_id: client.id }}
					onClose={() => (isConfirmingDelete = false)}
				/>
			{/if}
		</td>
	</tr>
{/if}
