<!--
	NoteActionsMenu — the note editor header's single "Note actions" ellipsis menu (054-DR, NT-04):
	Move (opens a list of the other contracts in the same menu), Export as Markdown, Export as PDF
	and Delete (Discard on an unsaved draft). The actions keep their behaviour: they are the panel's
	`note-panel-actions.ts` functions (save flush first, Undo toast after a delete); Delete on a
	saved note asks the header for its inline confirmation through `onRequestDelete`.
	Keyboard: the first item takes focus, arrows move, Escape closes and returns to the button.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { getDataService } from '$lib/services/context';
	import type { ContractOption } from '$lib/services/types';

	interface Props {
		/** null while the note is an unsaved draft (Move and Export are then unavailable) */
		noteId: string | null;
		contractId: string;
		onMove: (contract: ContractOption) => void;
		onExportMarkdown: () => void;
		onExportPdf: () => void;
		/** Saved note: ask for confirmation; draft: discard straight away */
		onRequestDelete: () => void;
	}

	let { noteId, contractId, onMove, onExportMarkdown, onExportPdf, onRequestDelete }: Props = $props();

	const dataService = getDataService();

	let isOpen = $state(false);
	let view = $state<'actions' | 'move'>('actions');
	let moveContracts = $state<ContractOption[]>([]);
	let rootElement = $state<HTMLElement | null>(null);
	let triggerElement = $state<HTMLButtonElement | null>(null);
	let menuElement = $state<HTMLElement | null>(null);

	function menuItems(): HTMLElement[] {
		return [...(menuElement?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
	}

	async function focusFirstItem() {
		await tick();
		menuItems()[0]?.focus();
	}

	function open() {
		view = 'actions';
		isOpen = true;
		void focusFirstItem();
	}

	function close({ returnFocus = false } = {}) {
		isOpen = false;
		view = 'actions';
		if (returnFocus) triggerElement?.focus();
	}

	async function showMoveList() {
		try {
			const allContracts = await dataService.getContracts();
			moveContracts = allContracts.filter((contract) => contract.id !== contractId);
			view = 'move';
			void focusFirstItem();
		} catch (contractError) {
			console.error('Error loading contracts:', contractError);
		}
	}

	function showActions() {
		view = 'actions';
		void focusFirstItem();
	}

	function run(action: () => void) {
		close();
		action();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close({ returnFocus: true });
			return;
		}
		if (event.key === 'Tab') {
			close();
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const items = menuItems();
		if (items.length === 0) return;
		const currentIndex = items.indexOf(document.activeElement as HTMLElement);
		const nextIndex =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? items.length - 1
					: (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
		items[nextIndex]?.focus();
	}

	/** Close on any click outside the menu */
	$effect(() => {
		if (!isOpen) return;
		const handleClick = (event: MouseEvent) => {
			if (!rootElement?.contains(event.target as Node)) close();
		};
		const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', handleClick);
		};
	});

	const itemClass =
		'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm menu-item pointer-coarse:py-3 disabled:cursor-not-allowed disabled:opacity-40';
</script>

<div class="relative" bind:this={rootElement} data-note-actions-menu>
	<button
		type="button"
		bind:this={triggerElement}
		onclick={() => (isOpen ? close() : open())}
		class="flex h-8 w-8 items-center justify-center rounded-md btn-quiet pointer-coarse:h-11 pointer-coarse:w-11"
		aria-label="Note actions"
		title="Note actions"
		aria-haspopup="menu"
		aria-expanded={isOpen}
		data-testid="note-actions-button"
	>
		<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
			<circle cx="4.5" cy="10" r="1.5" />
			<circle cx="10" cy="10" r="1.5" />
			<circle cx="15.5" cy="10" r="1.5" />
		</svg>
	</button>
	{#if isOpen}
		<div
			bind:this={menuElement}
			role="menu"
			tabindex="-1"
			aria-label={view === 'move' ? 'Move note to' : 'Note actions'}
			onkeydown={handleKeydown}
			class="absolute top-full right-0 z-30 mt-1 max-h-80 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md menu-panel py-1"
			data-testid="note-actions-menu"
		>
			{#if view === 'actions'}
				<button type="button" role="menuitem" class={itemClass} disabled={!noteId} onclick={showMoveList}>
					Move
					<span class="ml-auto text-xs text-ink-faint" aria-hidden="true">to another contract</span>
				</button>
				<button type="button" role="menuitem" class={itemClass} disabled={!noteId} onclick={() => run(onExportMarkdown)}>
					Export as Markdown
				</button>
				<button type="button" role="menuitem" class={itemClass} disabled={!noteId} onclick={() => run(onExportPdf)}>
					Export as PDF
				</button>
				<div class="my-1 border-t border-divider" role="separator"></div>
				<button
					type="button"
					role="menuitem"
					class="{itemClass} text-rust-700"
					title={noteId ? 'Delete this note' : 'Discard this empty draft'}
					onclick={() => run(onRequestDelete)}
				>
					{noteId ? 'Delete' : 'Discard'}
				</button>
			{:else}
				<button type="button" role="menuitem" class="{itemClass} text-ink-faint" onclick={showActions}>
					<span aria-hidden="true">‹</span> Move to
				</button>
				{#if moveContracts.length === 0}
					<span class="block px-3 py-1.5 text-sm text-ink-faint">No other contracts</span>
				{:else}
					{#each moveContracts as contract (contract.id)}
						<button type="button" role="menuitem" class="{itemClass} block" onclick={() => run(() => onMove(contract))}>
							<span class="font-medium">{contract.clientName}</span><span class="text-ink-faint"> / </span>{contract.name}
						</button>
					{/each}
				{/if}
			{/if}
		</div>
	{/if}
</div>
