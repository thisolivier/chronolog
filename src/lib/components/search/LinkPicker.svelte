<!--
	The `[[` wiki-link picker list (059-DR, SR-04..SR-07): presentational only, so the note editor
	and the time entry description (WikiLinkInput) can share it. No header, no scope tabs, no close
	control, no second input: it starts with the results; the query is typed where the `[[` is.
	Rows: contract mark, the readable title, then "Client / Contract"; the stable code is quiet and
	secondary (desktop: date and code at the right; phone: code under the context, no date). The
	active row has the sage fill and pine edge. The list is a listbox named "Link a note" (no
	visible heading); the caller keeps focus in its own text and moves `activeIndex`.
	Pressing on the panel never takes focus (mousedown is prevented), so the editor keeps its caret
	and a phone keeps its keyboard; `onChoose` runs on click / tap.
-->
<script lang="ts">
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { formatSmartDate } from '$lib/utils/format-date';
	import type { LinkPickerItem } from './link-targets';
	import type { LinkPickerStatus } from './link-picker-search.svelte';

	interface Props {
		items: LinkPickerItem[];
		status: LinkPickerStatus;
		activeIndex: number;
		variant: 'desktop' | 'phone';
		/** Prefix for the option ids (aria-activedescendant) */
		idPrefix: string;
		/** Upper bound for the panel's height in px (placement); the list scrolls inside */
		maxHeight?: number;
		onChoose: (index: number) => void;
		onActivate: (index: number) => void;
	}

	let { items, status, activeIndex, variant, idPrefix, maxHeight, onChoose, onActivate }: Props = $props();

	const isPhone = $derived(variant === 'phone');
	const busy = $derived(status === 'loading');

	let listElement: HTMLElement | undefined = $state();

	// Keep the active row in view while arrowing through a list taller than the panel
	$effect(() => {
		const active = listElement?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
		active?.scrollIntoView({ block: 'nearest' });
	});

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex flex-col overflow-hidden rounded-lg border border-divider bg-surface text-left shadow-lg"
	style:max-height={maxHeight !== undefined ? `${maxHeight}px` : undefined}
	onmousedown={(event) => event.preventDefault()}
	data-testid="link-picker"
	data-status={status}
	data-variant={variant}
>
	<ul
		bind:this={listElement}
		role="listbox"
		aria-label="Link a note"
		aria-busy={busy}
		class="min-h-0 flex-1 overflow-y-auto overscroll-contain {busy && items.length > 0 ? 'opacity-70' : ''}"
		id="{idPrefix}-list"
	>
		{#each items as item, index (item.noteId)}
			{@const active = index === activeIndex}
			<!-- Keys stay with the caller's text (arrows / Enter); a click or tap chooses -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				role="option"
				id="{idPrefix}-option-{index}"
				aria-selected={active}
				data-index={index}
				data-note-id={item.noteId}
				data-testid="link-picker-option"
				class="grid cursor-pointer items-start gap-x-3 border-l-2 px-3 {isPhone
					? 'grid-cols-[auto_minmax(0,1fr)] py-2.5'
					: 'grid-cols-[auto_minmax(0,1fr)_auto] py-2'} {active ? 'border-l-selection-edge bg-moss-100' : 'border-l-transparent'} {index > 0
					? 'border-t border-t-divider'
					: ''}"
				onmousemove={() => {
					if (!active) onActivate(index);
				}}
				onclick={() => onChoose(index)}
			>
				<span class="mt-0.5"><ContractMark
						contractName={item.contractName}
						contractId={item.contractId}
						colorIndex={item.clientColorIndex}
						size="md"
					/></span>
				<span class="min-w-0">
					<span class="block truncate text-sm font-semibold text-ink" data-testid="link-picker-title">{item.title}</span>
					<span class="block truncate text-xs text-ink-soft">{item.clientName} / {item.contractName}</span>
					{#if isPhone}
						<span class="block truncate font-mono text-[11px] text-ink-faint" data-testid="link-picker-code">{item.noteId}</span>
					{/if}
				</span>
				{#if !isPhone}
					<span class="flex flex-col items-end text-right whitespace-nowrap">
						<span class="text-xs text-ink-faint">{item.updatedAt ? formatSmartDate(item.updatedAt) : ''}</span>
						<span class="font-mono text-[11px] text-ink-faint" data-testid="link-picker-code">{item.noteId}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
	{#if status === 'error'}
		<p class="px-3 py-2 text-sm text-rust-600" role="alert" data-testid="link-picker-status" data-state="error">Couldn’t load notes. Keep typing to try again.</p>
	{:else if busy && items.length === 0}
		<p class="px-3 py-2 text-sm text-ink-muted" role="status" data-testid="link-picker-status" data-state="loading">Searching…</p>
	{:else if status === 'ready' && items.length === 0}
		<p class="px-3 py-2 text-sm text-ink-muted" role="status" data-testid="link-picker-status" data-state="empty">No matching notes</p>
	{/if}
</div>
