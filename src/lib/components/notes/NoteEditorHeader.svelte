<!--
	Note editor header (054-DR, NT-04): the contract mark with the copyable note code (code and copy
	icon both copy, 051-UI), the quiet save pill, and one "Note actions" ellipsis menu holding Move,
	Export and Delete (`NoteActionsMenu.svelte`). Delete on a saved note confirms inline (no native
	confirm(), which Tauri can suppress). The note's title lives in the body only.
	Client / contract text (NT-01): visible only in the single-column (phone) layout, where nothing
	else names the note's own contract; elsewhere it is screen-reader text beside the mark (the
	sidebar or the list header names it on screen). The free space after the save pill holds the
	quiet repeat of the contract's pattern tile (NT-03 / DS-04, sprint 063-DR). The single-column
	layout has none: there the save pill and the ellipsis sit on different rows.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import SaveStatusIndicator from './SaveStatusIndicator.svelte';
	import NoteCodeCopyButton from './NoteCodeCopyButton.svelte';
	import NoteActionsMenu from './NoteActionsMenu.svelte';
	import OutboxMarker from '$lib/offline/OutboxMarker.svelte';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import ContractTileRepeat from '$lib/components/identity/ContractTileRepeat.svelte';
	import type { SaveStatus } from './note-autosave';
	import type { ContractOption } from '$lib/services/types';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';

	interface Props {
		/** null while the note is an unsaved draft */
		noteId: string | null;
		contractId: string;
		saveStatus: SaveStatus;
		message?: string | null;
		/** Show "Client / Contract" as visible text (single-column layout); else screen readers only */
		showContextText?: boolean;
		onMove: (contract: ContractOption) => void;
		onExportMarkdown: () => void;
		onExportPdf: () => void;
		onDelete: () => void;
		/** Reload the server copy (offered when the note changed elsewhere) */
		onReload?: () => void;
	}

	let {
		noteId,
		contractId,
		saveStatus,
		message = null,
		showContextText = false,
		onMove,
		onExportMarkdown,
		onExportPdf,
		onDelete,
		onReload
	}: Props = $props();

	// The note's own contract (never the timer's, SH-08)
	const contractLabel = $derived(contractDirectory.labels[contractId]);
	const contextText = $derived(contractLabel ? `${contractLabel.clientName} / ${contractLabel.name}` : '');

	let isConfirmingDelete = $state(false);
	let confirmDeleteButton = $state<HTMLButtonElement | null>(null);

	async function requestDelete() {
		if (!noteId) return onDelete();
		isConfirmingDelete = true;
		// The menu that held Delete is gone: put focus on the confirmation instead of the page body
		await tick();
		confirmDeleteButton?.focus();
	}
</script>

{#snippet identity()}
	{#if contractLabel}
		<span class="flex min-w-0 items-center gap-mark-gap" title={contextText}>
			<ContractMark {contractId} contractName={contractLabel.name} colorIndex={contractLabel.clientColorIndex} size="sm" />
			<span
				class={showContextText ? 'min-w-0 truncate text-sm text-ink-muted' : 'sr-only'}
				data-testid="note-editor-context"
				data-contract-id={contractId}
				data-visible={showContextText ? 'true' : 'false'}
			>
				{contractLabel.clientName} <span class="text-ink-faint">/</span>
				<span class="font-semibold text-ink">{contractLabel.name}</span>
			</span>
		</span>
	{/if}
{/snippet}

{#snippet codeAndStatus()}
	{#if noteId}
		<NoteCodeCopyButton noteCode={noteId} />
	{:else}
		<span class="truncate font-mono text-xs text-ink-faint">New note</span>
	{/if}
	<SaveStatusIndicator status={saveStatus} isDraft={!noteId} />
	{#if noteId}<OutboxMarker resourceKey="note:{noteId}" />{/if}
	{#if saveStatus === 'conflict' && onReload}
		<button
			type="button"
			onclick={onReload}
			data-testid="reload-note"
			class="rounded bg-rust-50 px-2 py-0.5 text-xs font-medium text-rust-700 hover:bg-rust-100"
		>
			Reload
		</button>
	{/if}
	{#if message}
		<span role="alert" class="text-xs text-rust-600">{message}</span>
	{/if}
{/snippet}

{#snippet actions()}
	{#if isConfirmingDelete}
		<div class="flex items-center gap-2 text-xs" data-testid="delete-confirm">
			<span class="text-ink-muted">Delete this note?</span>
			<button
				type="button"
				bind:this={confirmDeleteButton}
				onclick={() => {
					isConfirmingDelete = false;
					onDelete();
				}}
				class="rounded btn-danger px-2.5 py-1 font-medium pointer-coarse:min-h-11 pointer-coarse:px-4"
			>
				Delete
			</button>
			<button
				type="button"
				onclick={() => (isConfirmingDelete = false)}
				class="rounded px-2.5 py-1 btn-quiet pointer-coarse:min-h-11 pointer-coarse:px-4"
			>
				Cancel
			</button>
		</div>
	{:else}
		<NoteActionsMenu {noteId} {contractId} {onMove} {onExportMarkdown} {onExportPdf} onRequestDelete={requestDelete} />
	{/if}
{/snippet}

<div class="border-b border-divider bg-surface px-4 py-1.5" data-testid="note-editor-header">
	{#if showContextText}
		<!-- Single column: the note's client / contract with the actions, then code and status -->
		<div class="flex items-center gap-2">
			<div class="min-w-0 flex-1">{@render identity()}</div>
			{@render actions()}
		</div>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">{@render codeAndStatus()}</div>
	{:else}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			{@render identity()}
			{@render codeAndStatus()}
			<!-- The contract repeat (NT-03): fills what the row leaves, shrinks to nothing first -->
			<div class="flex min-w-0 flex-1 items-center" aria-hidden="true" data-testid="note-editor-header-space">
				{#if contractLabel}
					<ContractTileRepeat {contractId} colorIndex={contractLabel.clientColorIndex} />
				{/if}
			</div>
			{@render actions()}
		</div>
	{/if}
</div>
