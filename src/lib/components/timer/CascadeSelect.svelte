<!--
	CascadeSelect — one level of the ontology cascade (sprint 055-DR, TC-05). Always one native
	select of the same height, whatever the state, so the form never shifts: browsable when the
	level is ready, otherwise disabled with the reason in place of the options ("Choose a contract
	first", "Loading…", "Not applicable", "Couldn't load …"). A failed level adds a Retry button
	on the same row. The native list is the anchored, browsable overlay (desktop and phone).
-->
<script lang="ts">
	import {
		CASCADE_NONE,
		levelPlaceholder,
		noneOptionLabel,
		type CascadeLevelName,
		type CascadeLevelState
	} from './ontology-cascade';

	let {
		level,
		id,
		state,
		value,
		onChoose,
		onRetry,
		invalid = false,
		errorId = undefined,
		size = 'compact',
		ariaLabel = undefined
	}: {
		level: CascadeLevelName;
		/** The select's id (for a <label for>); optional where the select is named by ariaLabel */
		id?: string;
		state: CascadeLevelState;
		value: string;
		onChoose: (id: string) => void;
		onRetry: () => void;
		/** Red border when the form reported "Pick a contract" */
		invalid?: boolean;
		/** The inline error's id, for aria-describedby */
		errorId?: string;
		/** 'compact' in the sidebar widget, 'regular' in the modal and on the phone screen */
		size?: 'compact' | 'regular';
		/** Accessible name when no <label> points at the select (the timesheet's inline editor) */
		ariaLabel?: string;
	} = $props();

	const placeholder = $derived(levelPlaceholder(level, state, Boolean(value)));
	const isBrowsable = $derived(state.status === 'ready');
	// A held root value the list does not offer (an archived contract): keep it selectable
	const heldValueMissing = $derived(
		level === 'contract' && isBrowsable && Boolean(value) && !state.options.some((option) => option.id === value)
	);
	// Below the contract, "No deliverable" / "No work type" is an explicit choice (CASCADE_NONE);
	// an unset value shows on the same option
	const noneValue = $derived(level === 'contract' ? '' : CASCADE_NONE);
	const shownValue = $derived(level !== 'contract' && value === '' ? CASCADE_NONE : value);

	const sizeClasses = $derived(size === 'compact' ? 'rounded-control px-1.5 py-1 text-sm' : 'rounded-control px-2 py-1.5 text-sm');
	const borderClasses = $derived(
		invalid ? 'border-rust-400 focus:border-rust-500 focus:ring-rust-500' : 'border-line focus:border-focus focus:ring-focus'
	);
</script>

<div class="flex min-w-0 items-stretch gap-1.5" data-testid="cascade-{level}" data-cascade-state={state.status}>
	{#if isBrowsable}
		<select
			{id}
			value={shownValue}
			onchange={(event) => onChoose(event.currentTarget.value)}
			aria-invalid={invalid}
			aria-describedby={errorId}
			aria-label={ariaLabel}
			class="block w-full min-w-0 flex-1 border bg-surface focus:ring-1 focus:outline-none {sizeClasses} {borderClasses}"
		>
			<option value={noneValue}>{noneOptionLabel(level)}</option>
			{#if heldValueMissing}<option {value}>Current contract (not in the list)</option>{/if}
			{#each state.options as option (option.id)}
				<option value={option.id}>{option.name}</option>
			{/each}
		</select>
	{:else}
		<select
			{id}
			disabled
			aria-invalid={invalid}
			aria-describedby={errorId}
			aria-label={ariaLabel}
			class="block w-full min-w-0 flex-1 border bg-sunken text-ink-faint {sizeClasses} {borderClasses}"
		>
			<option value="">{placeholder}</option>
		</select>
		{#if state.status === 'failed'}
			<button
				type="button"
				onclick={onRetry}
				class="flex-shrink-0 rounded-control btn-secondary px-2 text-xs font-medium"
				data-testid="cascade-{level}-retry"
			>
				Retry
			</button>
		{/if}
	{/if}
</div>
