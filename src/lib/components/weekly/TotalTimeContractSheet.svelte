<!--
	The phone's contract sheet (Total time r1, TT-05, sprint 066-TR): a tall sheet over the dimmed
	results, opened from the Contracts row. Header "Contracts" with All | None, the shared grouped
	list scrolling in the body, an anchored footer with "N selected" (the only count in the sheet)
	and Done, the bottom safe area kept. Ticks apply at once to the result behind it: there is no
	copy waiting for Apply, so Done, a backdrop tap and Escape (handled by the modal, sheet first)
	only close it. The footer is a flex sibling of the list, so it never covers the last row.
	iOS (follow-up fix): fixed over the visible viewport, the page scroll-locked, `touch-action: none`
	everywhere but the list (`pan-y`, overscroll contained), so the handle, header and footer never
	drag the page and Done stays reachable. Pull down to dismiss (`sheet-drag.ts`): drag the handle,
	header or footer, or pull the list down from its top, and the sheet follows the finger; released
	past 96 px or on a downward flick it closes through Done's path, otherwise it springs back.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { lockBodyScroll } from '$lib/utils/scroll-lock';
	import TotalTimeBulkActions from './TotalTimeBulkActions.svelte';
	import { selectedCountLabel } from './total-time';
	import { attachSheetDrag } from './sheet-drag';

	let {
		viewportStyle,
		selectedCount,
		onSelectAll,
		onSelectNone,
		onDone,
		children
	}: {
		/** The modal's visual-viewport box (top / height), so the sheet covers exactly the visible screen */
		viewportStyle: string;
		selectedCount: number;
		onSelectAll: () => void;
		onSelectNone: () => void;
		/** Closes the sheet; the selection is already applied */
		onDone: () => void;
		/** The contract list (TotalTimeContractList) */
		children: Snippet;
	} = $props();

	let sheetElement: HTMLDivElement | undefined = $state();
	let backdropElement: HTMLDivElement | undefined = $state();
	let scrollerElement: HTMLDivElement | undefined = $state();

	onMount(() => sheetElement?.focus());
	// A second lock (reference-counted): the page stays pinned until the modal's own lock goes too
	$effect(() => lockBodyScroll());
	$effect(() => {
		if (!sheetElement || !backdropElement || !scrollerElement) return;
		return attachSheetDrag(sheetElement, { scroller: scrollerElement, backdrop: backdropElement, onDismiss: () => onDone() });
	});

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) onDone();
	}
</script>

<div
	bind:this={backdropElement}
	class="fixed inset-x-0 z-10 flex touch-none flex-col justify-end bg-chalk-950/40"
	style={viewportStyle}
	onclick={handleBackdropClick}
	role="presentation"
	data-testid="total-time-sheet-backdrop"
>
	<div
		bind:this={sheetElement}
		class="flex max-h-[calc(100%-2.5rem)] min-h-[60%] flex-col rounded-t-2xl bg-surface shadow-xl focus:outline-none"
		role="dialog"
		aria-modal="true"
		aria-labelledby="total-time-sheet-title"
		tabindex="-1"
		data-testid="total-time-contract-sheet"
	>
		<div class="flex shrink-0 justify-center pt-2 pb-1" aria-hidden="true" data-testid="total-time-sheet-handle">
			<span class="h-1 w-10 rounded-full bg-chalk-300"></span>
		</div>
		<div class="flex shrink-0 items-center gap-2 px-4 pt-1 pb-3">
			<h3 id="total-time-sheet-title" class="flex-1 text-xl font-semibold text-primary">Contracts</h3>
			<TotalTimeBulkActions {onSelectAll} {onSelectNone} />
		</div>
		<div bind:this={scrollerElement} class="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-3" data-testid="total-time-sheet-scroller">
			{@render children()}
		</div>
		<div class="flex shrink-0 items-center gap-3 border-t border-divider px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
			<p class="flex-1 text-sm text-ink-muted" data-testid="total-time-selected-count">{selectedCountLabel(selectedCount)}</p>
			<button
				type="button"
				onclick={onDone}
				class="min-h-11 rounded-control btn-primary px-6 text-base font-semibold"
				data-testid="total-time-sheet-done"
			>Done</button>
		</div>
	</div>
</div>
