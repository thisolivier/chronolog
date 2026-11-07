<script lang="ts">
	/**
	 * Week status pill that opens a small menu of the three states, instead of a blind
	 * click-to-cycle. Arrow keys move, Enter/Space picks, Escape or a click outside closes.
	 */
	import { tick } from 'svelte';

	const WEEK_STATUSES = [
		{ value: 'Unsubmitted', hint: 'Still logging time' },
		{ value: 'Draft ready', hint: 'Ready to review' },
		{ value: 'Submitted', hint: 'Sent to the client' }
	];

	let {
		currentStatus,
		onStatusChange
	}: {
		currentStatus: string;
		onStatusChange: (newStatus: string) => void;
	} = $props();

	let isOpen = $state(false);
	let menuElement: HTMLElement | undefined = $state();
	let triggerElement: HTMLButtonElement | undefined = $state();

	function getStatusClasses(status: string): string {
		switch (status) {
			case 'Draft ready':
				return 'bg-amber-100 text-amber-800';
			case 'Submitted':
				return 'bg-emerald-100 text-emerald-800';
			default:
				return 'bg-stone-100 text-stone-600';
		}
	}

	async function openMenu() {
		isOpen = true;
		await tick();
		const currentOption = menuElement?.querySelector<HTMLElement>('[aria-checked="true"]');
		(currentOption ?? menuElement?.querySelector<HTMLElement>('[role="menuitemradio"]'))?.focus();
	}

	function closeMenu(returnFocus = true) {
		isOpen = false;
		if (returnFocus) triggerElement?.focus();
	}

	function chooseStatus(status: string) {
		if (status !== currentStatus) onStatusChange(status);
		closeMenu();
	}

	function handleMenuKeydown(event: KeyboardEvent) {
		const options = Array.from(menuElement?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
		const focusedIndex = options.indexOf(document.activeElement as HTMLElement);
		if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			options[(focusedIndex + 1) % options.length]?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			options[(focusedIndex - 1 + options.length) % options.length]?.focus();
		} else if (event.key === 'Tab') {
			closeMenu(false);
		}
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (!isOpen) return;
		const target = event.target as Node;
		if (!menuElement?.contains(target) && !triggerElement?.contains(target)) closeMenu(false);
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="relative">
	<button
		bind:this={triggerElement}
		onclick={() => (isOpen ? closeMenu() : openMenu())}
		aria-haspopup="menu"
		aria-expanded={isOpen}
		aria-label="Week status: {currentStatus}. Change status"
		class="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap {getStatusClasses(currentStatus)}"
	>
		{currentStatus}
		<span aria-hidden="true" class="text-[9px]">&#9662;</span>
	</button>

	{#if isOpen}
		<div
			bind:this={menuElement}
			role="menu"
			tabindex="-1"
			aria-label="Week status"
			onkeydown={handleMenuKeydown}
			class="absolute right-0 top-full z-30 mt-1 w-48 rounded-md menu-panel py-1"
		>
			{#each WEEK_STATUSES as status (status.value)}
				<button
					role="menuitemradio"
					aria-checked={status.value === currentStatus}
					onclick={() => chooseStatus(status.value)}
					class="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-stone-50 focus:bg-stone-100 focus:outline-none"
				>
					<span class="mt-0.5 w-3 text-xs text-blue-600">{status.value === currentStatus ? '✓' : ''}</span>
					<span>
						<span class="block text-sm text-stone-800">{status.value}</span>
						<span class="block text-xs text-stone-400">{status.hint}</span>
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
