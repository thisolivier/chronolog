<!--
	TimerContractMenu — the running timer's contract picker in the identity header (sprint 064-DR, T4).
	The trigger reads "Select" until the capture has a contract and "Change" after; it opens a menu
	of the user's contracts ("Client / Contract", `formatContractLabel`), the current one checked.
	Choosing calls `onChoose`; an outside click, Escape or Tab closes it with nothing changed.
	Escape and a choice put focus back on the trigger; an outside click does so only when focus
	would otherwise be lost. Arrow keys move, Home / End jump, Enter / Space choose (native buttons).
	The menu is `position: fixed` (placed by `contract-menu.ts`), so neither the sidebar's
	`overflow: hidden` nor the phone capture screen clips it. Rows are at least 44 px tall.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { formatContractLabel } from './contract-label';
	import { nextMenuItemIndex, placeContractMenu, type MenuPlacement } from './contract-menu';
	import type { ContractOption } from '$lib/services/types';

	let {
		contracts,
		selectedContractId,
		onChoose,
		onOpen
	}: {
		contracts: ContractOption[];
		/** The capture's contract; empty while it has none */
		selectedContractId: string;
		onChoose: (contractId: string) => void;
		/** The menu opened (the widget refreshes its contract list) */
		onOpen?: () => void;
	} = $props();

	const PREFERRED_WIDTH_REM = 16;
	const ROW_HEIGHT_PIXELS = 44;

	let isOpen = $state(false);
	let placement = $state<MenuPlacement | null>(null);
	let triggerButton = $state<HTMLButtonElement | null>(null);
	let menuElement = $state<HTMLElement | null>(null);

	const hasContract = $derived(Boolean(selectedContractId));

	function menuItems(): HTMLElement[] {
		return [...(menuElement?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
	}

	function reposition() {
		if (!triggerButton) return;
		const box = triggerButton.getBoundingClientRect();
		const remPixels = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const contentHeight = Math.max(1, contracts.length) * ROW_HEIGHT_PIXELS + 8;
		placement = placeContractMenu(
			{ left: box.left, top: box.top, bottom: box.bottom },
			{ width: window.innerWidth, height: window.innerHeight },
			PREFERRED_WIDTH_REM * remPixels,
			contentHeight
		);
	}

	async function open() {
		onOpen?.();
		reposition();
		isOpen = true;
		await tick();
		const items = menuItems();
		(items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0] ?? menuElement)?.focus();
	}

	function close(returnFocus: boolean) {
		if (!isOpen) return;
		isOpen = false;
		if (returnFocus) triggerButton?.focus();
	}

	function choose(contractId: string) {
		close(true);
		if (contractId !== selectedContractId) onChoose(contractId);
	}

	function handleMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			// Not the capture screen's Escape (which would close the whole screen)
			event.preventDefault();
			event.stopPropagation();
			close(true);
			return;
		}
		if (event.key === 'Tab') {
			close(false);
			return;
		}
		const items = menuItems();
		const nextIndex = nextMenuItemIndex(event.key, items.indexOf(document.activeElement as HTMLElement), items.length);
		if (nextIndex === null) return;
		event.preventDefault();
		items[nextIndex]?.focus();
	}

	async function handleOutsidePointer(event: PointerEvent) {
		if (!isOpen) return;
		const target = event.target as Node;
		if (menuElement?.contains(target) || triggerButton?.contains(target)) return;
		close(false);
		await tick();
		const activeElement = document.activeElement;
		if (!activeElement || activeElement === document.body) triggerButton?.focus();
	}

	// While open, follow the trigger through resizes and scrolls
	$effect(() => {
		if (!isOpen) return;
		window.addEventListener('resize', reposition);
		document.addEventListener('scroll', reposition, { capture: true, passive: true });
		return () => {
			window.removeEventListener('resize', reposition);
			document.removeEventListener('scroll', reposition, { capture: true });
		};
	});
</script>

<svelte:window onpointerdown={handleOutsidePointer} />

<button
	bind:this={triggerButton}
	type="button"
	class="flex-shrink-0 rounded text-xs font-medium text-pine-700 underline decoration-pine-300 underline-offset-2 hover:text-pine-900 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
	aria-label={hasContract ? 'Change contract' : 'Select a contract'}
	aria-haspopup="menu"
	aria-expanded={isOpen}
	data-testid={hasContract ? 'timer-change-contract' : 'timer-select-contract'}
	onclick={() => (isOpen ? close(true) : open())}
>
	{hasContract ? 'Change' : 'Select'}
</button>

{#if isOpen && placement}
	<div
		bind:this={menuElement}
		role="menu"
		tabindex="-1"
		aria-label="Contract for this timer"
		onkeydown={handleMenuKeydown}
		class="fixed z-50 overflow-y-auto rounded-md menu-panel py-1"
		style:left="{placement.left}px"
		style:width="{placement.width}px"
		style:max-height="{placement.maxHeight}px"
		style:top={placement.top === null ? undefined : `${placement.top}px`}
		style:bottom={placement.bottom === null ? undefined : `${placement.bottom}px`}
		data-testid="timer-contract-menu"
	>
		{#each contracts as contract (contract.id)}
			{@const isCurrent = contract.id === selectedContractId}
			<button
				type="button"
				role="menuitemradio"
				aria-checked={isCurrent}
				data-contract-id={contract.id}
				onclick={() => choose(contract.id)}
				class="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm menu-item"
			>
				<span class="w-3.5 flex-shrink-0 text-pine-700" aria-hidden="true">{isCurrent ? '✓' : ''}</span>
				<span class="min-w-0 break-words">{formatContractLabel(contract.clientName, contract.name)}</span>
			</button>
		{:else}
			<p class="px-3 py-2 text-sm text-ink-faint">No contracts yet</p>
		{/each}
	</div>
{/if}
