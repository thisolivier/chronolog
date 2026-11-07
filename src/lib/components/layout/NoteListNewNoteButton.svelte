<!--
	NoteListNewNoteButton — the note list's New Note (sprint 039-CL split). Under a contract it starts
	a draft for that contract. In the client view a client with one contract uses it; with several,
	the button opens a small menu asking which contract the note is for. In all notes (051-UI) the
	menu lists every active contract, each named "Client · Contract" (`withClientNames`).
-->
<script lang="ts">
	import type { ContractsByClientResult } from '$lib/services/types';

	let {
		contractId,
		clientContracts,
		withClientNames = false,
		onCreate
	}: {
		/** The list's contract; null in the client view */
		contractId: string | null;
		/** The viewed client's contracts (client view only) */
		clientContracts: ContractsByClientResult[];
		/** Name each menu item "Client · Contract" (the list spans several clients) */
		withClientNames?: boolean;
		onCreate: (contractId: string) => void;
	} = $props();

	let isMenuOpen = $state(false);
	let menuElement = $state<HTMLElement | null>(null);

	const isDisabled = $derived(!contractId && clientContracts.length === 0);

	function handleClick() {
		if (contractId) return onCreate(contractId);
		if (clientContracts.length === 1) return onCreate(clientContracts[0].id);
		isMenuOpen = !isMenuOpen;
		if (isMenuOpen) queueMicrotask(() => menuElement?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function choose(chosenContractId: string) {
		isMenuOpen = false;
		onCreate(chosenContractId);
	}

	function handleMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isMenuOpen = false;
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const items = [...(menuElement?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const currentIndex = items.indexOf(document.activeElement as HTMLElement);
		const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
		items[nextIndex]?.focus();
	}
</script>

<svelte:window onclick={(event) => isMenuOpen && !menuElement?.parentElement?.contains(event.target as Node) && (isMenuOpen = false)} />

<div class="relative">
	<button
		type="button"
		onclick={handleClick}
		disabled={isDisabled}
		aria-haspopup={contractId ? undefined : 'menu'}
		aria-expanded={contractId ? undefined : isMenuOpen}
		class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium whitespace-nowrap text-on-accent hover:bg-primary-hover
			disabled:cursor-not-allowed disabled:opacity-50"
	>
		New Note
	</button>
	{#if isMenuOpen}
		<div
			bind:this={menuElement}
			role="menu"
			tabindex="-1"
			aria-label="New note for which contract?"
			onkeydown={handleMenuKeydown}
			class="absolute right-0 z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-md menu-panel py-1"
			data-testid="new-note-contract-menu"
		>
			<p class="px-3 py-1 text-[11px] font-semibold uppercase text-ink-faint">New note for</p>
			{#each clientContracts as contract (contract.id)}
				<button
					type="button"
					role="menuitem"
					onclick={() => choose(contract.id)}
					class="block w-full truncate px-3 py-1.5 text-left text-sm menu-item"
				>
					{withClientNames ? `${contract.clientName} · ${contract.name}` : contract.name}
				</button>
			{/each}
		</div>
	{/if}
</div>
