<!--
	Note editor header: note ID, save status, and the Move / Export / Delete actions.
	Delete asks for confirmation inline (no native confirm(), which Tauri can suppress).
-->
<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import SaveStatusIndicator from './SaveStatusIndicator.svelte';
	import OutboxMarker from '$lib/offline/OutboxMarker.svelte';
	import type { SaveStatus } from './note-autosave';
	import type { ContractOption } from '$lib/services/types';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';

	interface Props {
		/** null while the note is an unsaved draft */
		noteId: string | null;
		contractId: string;
		saveStatus: SaveStatus;
		message?: string | null;
		onMove: (contract: ContractOption) => void;
		onExportMarkdown: () => void;
		onExportPdf: () => void;
		onDelete: () => void;
		/** Reload the server copy (offered when the note changed elsewhere) */
		onReload?: () => void;
	}

	let { noteId, contractId, saveStatus, message = null, onMove, onExportMarkdown, onExportPdf, onDelete, onReload }: Props =
		$props();

	const dataService = getDataService();

	// Rule 4: the editor names the note's client and contract, not only its ID
	const contractLabel = $derived(contractDirectory.labels[contractId]);

	let openMenu = $state<'move' | 'export' | null>(null);
	let moveContracts = $state<ContractOption[]>([]);
	let isConfirmingDelete = $state(false);

	/** Close an open menu on any click outside it */
	$effect(() => {
		if (!openMenu) return;
		const selector = openMenu === 'move' ? '[data-move-menu]' : '[data-export-menu]';
		const handleClick = (event: MouseEvent) => {
			if (!(event.target as HTMLElement).closest(selector)) openMenu = null;
		};
		const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', handleClick);
		};
	});

	async function toggleMoveMenu() {
		if (openMenu === 'move') {
			openMenu = null;
			return;
		}
		try {
			const allContracts = await dataService.getContracts();
			moveContracts = allContracts.filter((contract) => contract.id !== contractId);
			openMenu = 'move';
		} catch (contractError) {
			console.error('Error loading contracts:', contractError);
		}
	}

	const menuButtonClass =
		'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11';
	const menuItemClass = 'block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 pointer-coarse:py-3';
</script>

<div
	class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-stone-200 bg-white px-4 py-2"
	data-testid="note-editor-header"
>
	<div class="flex min-w-0 items-center gap-3">
		{#if contractLabel}
			<span class="truncate text-xs text-stone-600" data-testid="note-editor-context">
				{contractLabel.clientName} <span class="text-stone-400">/</span>
				<span class="font-medium text-stone-800">{contractLabel.name}</span>
			</span>
		{/if}
		<span class="truncate font-mono text-xs text-stone-400">{noteId ?? 'New note'}</span>
		<SaveStatusIndicator status={saveStatus} isDraft={!noteId} />
		{#if noteId}<OutboxMarker resourceKey="note:{noteId}" />{/if}
		{#if saveStatus === 'conflict' && onReload}
			<button
				type="button"
				onclick={onReload}
				data-testid="reload-note"
				class="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
			>
				Reload
			</button>
		{/if}
		{#if message}
			<span role="alert" class="text-xs text-red-600">{message}</span>
		{/if}
	</div>

	{#if isConfirmingDelete}
		<div class="flex items-center gap-2 text-xs" data-testid="delete-confirm">
			<span class="text-stone-600">Delete this note?</span>
			<button
				type="button"
				onclick={() => {
					isConfirmingDelete = false;
					onDelete();
				}}
				class="rounded bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700 pointer-coarse:min-h-11 pointer-coarse:px-4"
			>
				Delete
			</button>
			<button
				type="button"
				onclick={() => (isConfirmingDelete = false)}
				class="rounded px-2.5 py-1 text-stone-600 hover:bg-stone-100 pointer-coarse:min-h-11 pointer-coarse:px-4"
			>
				Cancel
			</button>
		</div>
	{:else}
		<div class="flex items-center gap-1">
			<div class="relative" data-move-menu>
				<button type="button" onclick={toggleMoveMenu} disabled={!noteId} class={menuButtonClass}>
					Move ▾
				</button>
				{#if openMenu === 'move'}
					<div class="absolute right-0 top-full z-10 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-md max-md:right-auto max-md:left-0 border border-stone-200 bg-white py-1 shadow-lg">
						{#if moveContracts.length === 0}
							<span class="block px-3 py-1.5 text-sm text-stone-400">No other contracts</span>
						{:else}
							{#each moveContracts as contract (contract.id)}
								<button
									type="button"
									onclick={() => {
										openMenu = null;
										onMove(contract);
									}}
									class={menuItemClass}
								>
									<span class="font-medium">{contract.clientName}</span>
									<span class="text-stone-400"> / </span>
									{contract.name}
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>

			<div class="relative" data-export-menu>
				<button
					type="button"
					onclick={() => (openMenu = openMenu === 'export' ? null : 'export')}
					disabled={!noteId}
					class={menuButtonClass}
				>
					Export ▾
				</button>
				{#if openMenu === 'export'}
					<div class="absolute right-0 top-full z-10 mt-1 w-44 rounded-md max-md:right-auto max-md:left-0 border border-stone-200 bg-white py-1 shadow-lg">
						<button
							type="button"
							onclick={() => {
								openMenu = null;
								onExportMarkdown();
							}}
							class={menuItemClass}
						>
							Export as Markdown
						</button>
						<button
							type="button"
							onclick={() => {
								openMenu = null;
								onExportPdf();
							}}
							class={menuItemClass}
						>
							Export as PDF
						</button>
					</div>
				{/if}
			</div>

			<span class="mx-1 h-4 w-px bg-stone-200" aria-hidden="true"></span>

			<button
				type="button"
				onclick={() => (noteId ? (isConfirmingDelete = true) : onDelete())}
				class="rounded px-2.5 py-1 text-xs text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 pointer-coarse:min-h-11"
				title={noteId ? 'Delete this note' : 'Discard this empty draft'}
			>
				{noteId ? 'Delete' : 'Discard'}
			</button>
		</div>
	{/if}
</div>
