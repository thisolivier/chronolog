<!--
	ToolbarMenu — a small menu for the editor toolbar (054-DR, NT-05): the phone's heading choice,
	its "Formatting" overflow and the Rich / Raw choice. The trigger and the items keep the editor's
	focus and selection: their mousedown is prevented, and a mouse or touch open leaves focus in the
	editor; a keyboard open moves focus to the first item. Choosing an item (any element with a
	`role="menuitem…"`) closes the menu. Escape closes it (and, from inside the menu, returns focus
	to the trigger).
-->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	interface Props {
		/** Accessible name of the trigger and the menu, e.g. "Formatting" */
		label: string;
		title?: string;
		testId?: string;
		triggerClass?: string;
		/** Right-align the panel under the trigger (else left) */
		alignRight?: boolean;
		trigger: Snippet;
		items: Snippet;
	}

	let { label, title = label, testId, triggerClass = '', alignRight = false, trigger, items }: Props = $props();

	let isOpen = $state(false);
	let rootElement = $state<HTMLElement | null>(null);
	let triggerElement = $state<HTMLButtonElement | null>(null);
	let menuElement = $state<HTMLElement | null>(null);

	function menuItems(): HTMLElement[] {
		return [...(menuElement?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])];
	}

	async function toggle(event: MouseEvent) {
		isOpen = !isOpen;
		// A keyboard press (detail 0) moves into the menu; a pointer leaves focus in the editor
		if (isOpen && event.detail === 0) {
			await tick();
			menuItems()[0]?.focus();
		}
	}

	function close({ returnFocus = false } = {}) {
		isOpen = false;
		if (returnFocus) triggerElement?.focus();
	}

	function handleMenuClick(event: MouseEvent) {
		if ((event.target as HTMLElement).closest('[role^="menuitem"]')) close();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close({ returnFocus: true });
			return;
		}
		if (event.key === 'Tab') return close();
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const itemElements = menuItems();
		const currentIndex = itemElements.indexOf(document.activeElement as HTMLElement);
		const nextIndex = (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + itemElements.length) % itemElements.length;
		itemElements[nextIndex]?.focus();
	}

	$effect(() => {
		if (!isOpen) return;
		const handleOutside = (event: Event) => {
			if (!rootElement?.contains(event.target as Node)) close();
		};
		// Opened by pointer, focus stays in the editor: Escape there closes the menu too
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !menuElement?.contains(event.target as Node)) close();
		};
		const timer = setTimeout(() => document.addEventListener('pointerdown', handleOutside), 0);
		document.addEventListener('keydown', handleEscape);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('pointerdown', handleOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	});
</script>

<div class="relative shrink-0" bind:this={rootElement}>
	<button
		type="button"
		bind:this={triggerElement}
		onmousedown={(event) => event.preventDefault()}
		onclick={toggle}
		onkeydown={(event) => event.key === 'Escape' && isOpen && close()}
		class={triggerClass}
		aria-label={label}
		{title}
		aria-haspopup="menu"
		aria-expanded={isOpen}
		data-testid={testId}
	>
		{@render trigger()}
	</button>
	{#if isOpen}
		<div
			bind:this={menuElement}
			role="menu"
			tabindex="-1"
			aria-label={label}
			onmousedown={(event) => event.preventDefault()}
			onclick={handleMenuClick}
			onkeydown={handleKeydown}
			class="absolute top-full z-30 mt-1 w-52 max-w-[calc(100vw-2rem)] rounded-md menu-panel py-1 {alignRight ? 'right-0' : 'left-0'}"
			data-testid={testId ? `${testId}-menu` : undefined}
		>
			{@render items()}
		</div>
	{/if}
</div>
