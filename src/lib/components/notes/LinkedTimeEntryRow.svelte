<!--
	LinkedTimeEntryRow — one linked time entry under the note (split from LinkedTimeEntries, 064-DR).
	A small clock glyph, the date and the description (wiki-links stay clickable) open the entry's
	day; the contract line shows only when the entry is on another contract than the note (054-DR).
	The right-hand group is the duration and ×. Since 064-DR (N3) × asks first: the group becomes
	"Unlink? Unlink / Cancel" (the editor header's delete-confirm style; no native confirm()).
	Escape cancels. The parent owns which row is confirming and where focus goes.
-->
<script lang="ts">
	import { formatDuration } from '$lib/utils/iso-week';
	import WikiLinkRenderer from '$lib/components/weekly/WikiLinkRenderer.svelte';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import type { LinkedTimeEntryDisplay } from '$lib/services/types';

	interface Props {
		entry: LinkedTimeEntryDisplay;
		/** Name the entry's client / contract (it is not the note's own) */
		showContract: boolean;
		isConfirmingUnlink: boolean;
		onOpen: () => void;
		onOpenNote: (noteId: string) => void;
		onRequestUnlink: () => void;
		onConfirmUnlink: () => void;
		onCancelUnlink: () => void;
	}

	let { entry, showContract, isConfirmingUnlink, onOpen, onOpenNote, onRequestUnlink, onConfirmUnlink, onCancelUnlink }: Props =
		$props();

	/** Escape on either confirm button keeps the link */
	function cancelOnEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		onCancelUnlink();
	}

	const dateLabel = $derived(
		new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
	);
</script>

<div class="group flex items-start justify-between gap-2 rounded px-2 py-1.5 hover:bg-chalk-50" data-time-entry-id={entry.timeEntryId}>
	<div
		role="button"
		tabindex="0"
		class="min-w-0 flex-1 cursor-pointer"
		title="Open {dateLabel} in Time Entries"
		data-testid="linked-time-entry"
		onclick={onOpen}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onOpen();
			}
		}}
	>
		<div class="flex items-center gap-2">
			<svg
				viewBox="0 0 20 20"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				class="h-3.5 w-3.5 shrink-0 text-ink-faint"
				aria-hidden="true"
				data-testid="linked-time-entry-clock"
			>
				<circle cx="10" cy="10" r="7.25" />
				<path d="M10 6v4.25l2.75 1.75" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			<span class="sr-only">Linked time entry,</span>
			<!-- One line on a phone: the date never wraps into the description or duration (043) -->
			<span class="shrink-0 whitespace-nowrap text-xs font-medium text-ink-muted group-hover:underline" data-testid="linked-time-entry-date">
				{dateLabel}
			</span>
			{#if entry.description}
				<span class="min-w-0 truncate text-sm text-ink-muted">
					— <WikiLinkRenderer text={entry.description} onNoteLinkClick={onOpenNote} />
				</span>
			{/if}
		</div>
		{#if showContract}
			<div class="mt-0.5 flex min-w-0 items-center gap-mark-gap text-xs text-ink-faint" data-testid="linked-time-entry-contract">
				<ContractMark contractName={entry.contractName} contractId={entry.contractId} colorIndex={entry.clientColorIndex} size="sm" />
				<span class="truncate">{entry.clientName} / {entry.contractName}</span>
			</div>
		{/if}
	</div>
	{#if isConfirmingUnlink}
		<div
			role="group"
			aria-label="Unlink this time entry?"
			class="flex shrink-0 items-center gap-2 text-xs"
			data-testid="unlink-confirm"
		>
			<span class="text-ink-muted">Unlink?</span>
			<button
				type="button"
				onclick={onConfirmUnlink}
				onkeydown={cancelOnEscape}
				class="rounded btn-danger px-2.5 py-1 font-medium pointer-coarse:min-h-11 pointer-coarse:px-4"
				data-unlink-confirm
			>
				Unlink
			</button>
			<button
				type="button"
				onclick={onCancelUnlink}
				onkeydown={cancelOnEscape}
				class="rounded px-2.5 py-1 btn-quiet pointer-coarse:min-h-11 pointer-coarse:px-4"
			>
				Cancel
			</button>
		</div>
	{:else}
		<div class="flex shrink-0 items-center gap-2">
			<span class="whitespace-nowrap text-xs text-ink-faint" data-testid="linked-time-entry-duration">
				{formatDuration(entry.durationMinutes)}
			</span>
			<button
				type="button"
				onclick={onRequestUnlink}
				class="text-chalk-300 opacity-0 transition-opacity hover:text-rust-500 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:text-ink-faint pointer-coarse:opacity-100"
				title="Unlink time entry"
				aria-label="Unlink time entry"
				data-unlink-request
			>
				&times;
			</button>
		</div>
	{/if}
</div>
