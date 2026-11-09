<!--
	TimerRunningPanel — the running timer's body (TC-01/TC-03/TC-07, sprints 049, 053-DR, 055-DR):
	the elapsed clock and Stop (text exactly "Stop": the Tauri tray clicks it), the editable start
	and the description. The contract is chosen from the identity header's picker (064-DR), not here.
	The description comes
	with Add note (once a contract is chosen) and Split time (desktop; opens the split overlay, sprint 056-DR).
	`layout="screen"` is the phone capture screen: a large clock, the fields in a scrolling area,
	and Add note and Stop pinned at the bottom above the keyboard and the home indicator.
-->
<script lang="ts">
	import TimerDisplay from './TimerDisplay.svelte';
	import TimerStartField from './TimerStartField.svelte';
	import SplitTimeButton from './SplitTimeButton.svelte';
	import AttachNoteButton from '$lib/components/weekly/AttachNoteButton.svelte';
	import { revealFocusedField } from './visual-viewport.svelte';
	import type { StartChangeResult } from './timer-start-edit';

	let {
		elapsedSeconds,
		startTime,
		startDate,
		onChangeStart,
		onStop,
		draftContractId,
		draftDescription = $bindable(''),
		onDescriptionInput,
		onAttachNote,
		onSplit = undefined,
		splitDisabledReason = '',
		layout = 'panel'
	}: {
		elapsedSeconds: number;
		startTime: string;
		startDate: string;
		onChangeStart: (start: { date: string; startTime: string }, confirmed: boolean) => Promise<StartChangeResult>;
		onStop: () => void;
		/** The capture's contract (empty until chosen in the header): enables Add note */
		draftContractId: string;
		draftDescription: string;
		onDescriptionInput: () => void;
		onAttachNote: () => Promise<void>;
		onSplit?: () => void;
		/** Why Split is disabled (split-entry.ts) */
		splitDisabledReason?: string;
		layout?: 'panel' | 'screen';
	} = $props();

	const isScreen = $derived(layout === 'screen');

	let isAttaching = $state(false);
	async function attachFromScreen() {
		if (!draftContractId || isAttaching) return;
		isAttaching = true;
		try {
			await onAttachNote();
		} finally {
			isAttaching = false;
		}
	}
</script>

{#snippet stopButton(extraClasses: string)}
	<button
		onclick={onStop}
		class="rounded-control btn-danger px-3 py-1 text-sm font-medium whitespace-nowrap pointer-coarse:min-h-11 pointer-coarse:px-5 {extraClasses}"
	>
		Stop
	</button>
{/snippet}

{#snippet fields()}
	<div class="space-y-2">
		<div>
			<div class="flex items-center justify-between">
				<label for="draft-description" class="block text-xs font-medium text-ink-muted">Description</label>
				{#if !isScreen}
					<span class="flex items-center gap-0.5">
						{#if draftContractId}<AttachNoteButton alwaysVisible onAttach={onAttachNote} />{/if}
						<SplitTimeButton {onSplit} disabledReason={splitDisabledReason} />
					</span>
				{/if}
			</div>
			<textarea
				id="draft-description"
				bind:value={draftDescription}
				oninput={onDescriptionInput}
				rows={isScreen ? 3 : 2}
				class="mt-0.5 block w-full rounded-control input-base px-1.5 py-1 {isScreen ? 'text-sm' : 'text-xs'}"
				placeholder="What are you working on?"
			></textarea>
		</div>
	</div>
{/snippet}

{#if isScreen}
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="min-h-0 flex-1 scroll-pt-2 scroll-pb-4 space-y-3 overflow-y-auto overscroll-contain px-4 pt-1 pb-4" onfocusin={revealFocusedField}>
			<TimerDisplay {elapsedSeconds} size="large" />
			<TimerStartField {startTime} {startDate} {onChangeStart} />
			{@render fields()}
		</div>
		<div
			class="flex shrink-0 gap-2 border-t border-divider bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
			data-testid="capture-running-actions"
		>
			<button
				type="button"
				onclick={attachFromScreen}
				aria-disabled={!draftContractId || isAttaching}
				title={draftContractId ? 'Create a note and link it from this entry' : 'Choose a contract first'}
				class="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-control btn-secondary px-3 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
				data-testid="capture-add-note"
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
					<path d="M9.5 1.75H4.25a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h4.5" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M9.5 1.75 12.75 5v3.25M9.5 1.75V5h3.25" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M12 10.25v4M10 12.25h4" stroke-linecap="round" />
				</svg>
				{isAttaching ? 'Adding…' : 'Add note'}
			</button>
			{@render stopButton('flex-1 min-h-11')}
		</div>
	</div>
{:else}
	<div class="space-y-3">
		<div class="flex items-center justify-between gap-2">
			<TimerDisplay {elapsedSeconds} isPaused={false} />
			{@render stopButton('')}
		</div>
		<TimerStartField {startTime} {startDate} {onChangeStart} />
		{@render fields()}
	</div>
{/if}
