<!--
	SplitTimesFields — one split card's duration and From / To (SP-02). The duration is typed text
	read by the shared parser and applied only when confirmed (Enter or leaving the field), so the
	boundary never moves while typing or on a tick. From / To are 24-hour text fields (sprint 060-DR:
	a native time input reads 12-hour under en-US), applied once a whole HH:MM is typed or on leaving
	the field; "Now" stands for the live end. Errors (zero, negative, unreadable) show inline under the fields.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { formatMinutes } from '$lib/utils/duration';
	import { clockOf } from './split-times';
	import { isWholeClockText, parseClockText } from '$lib/utils/clock-text';

	let {
		idPrefix,
		minutes,
		from,
		to,
		fromEditable = true,
		toEditable = true,
		suffix = '',
		problem = '',
		disabled = false,
		onConfirmDuration,
		onFrom,
		onTo
	}: {
		idPrefix: string;
		/** The part's whole minutes (seconds rounded up) */
		minutes: number;
		from: number;
		/** null: live, ends at Now */
		to: number | null;
		fromEditable?: boolean;
		toEditable?: boolean;
		/** "until now" beside a live duration */
		suffix?: string;
		/** The part's time problem from the session (zero or negative length) */
		problem?: string;
		disabled?: boolean;
		/** Returns an error message, or '' when the duration was applied */
		onConfirmDuration: (text: string) => string;
		onFrom: (clock: string) => void;
		onTo: (clock: string) => void;
	} = $props();

	let isEditing = $state(false);
	let typedText = $state('');
	let durationError = $state('');
	const shownDuration = $derived(isEditing || durationError ? typedText : formatMinutes(minutes));

	// A change made elsewhere (From, To, the other card) replaces a refused typed duration
	$effect(() => {
		void from;
		void to;
		untrack(() => {
			if (!isEditing) durationError = '';
		});
	});

	function beginEditing() {
		if (isEditing) return;
		typedText = durationError ? typedText : formatMinutes(minutes);
		isEditing = true;
	}

	function confirmDuration() {
		if (!isEditing) return;
		isEditing = false;
		if (typedText.trim() === formatMinutes(minutes)) {
			durationError = '';
			return;
		}
		durationError = onConfirmDuration(typedText);
	}

	function handleDurationKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			confirmDuration();
		} else if (event.key === 'Escape' && (isEditing || durationError)) {
			// Put the duration back; the overlay's own Escape must not also fire
			event.stopPropagation();
			isEditing = false;
			durationError = '';
		}
	}

	/**
	 * Apply a typed clock, then show what the session kept (it may clamp it, or refuse it). While
	 * typing only a whole HH:MM applies; leaving the field (change) or Enter also reads `905` or `9:05`.
	 */
	async function handleClockChange(event: Event, apply: (clock: string) => void, kept: () => number | null) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.type === 'input' && !isWholeClockText(input.value)) return;
		const clock = parseClockText(input.value);
		if (clock) apply(clock);
		await tick();
		const value = kept();
		if (value !== null) input.value = clockOf(value);
	}

	/** Enter confirms a clock as leaving the field does */
	function handleClockKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		(event.currentTarget as HTMLInputElement).dispatchEvent(new Event('change'));
	}

	const message = $derived(durationError || problem);
	const inputClass = 'rounded-control input-base px-2 py-1 text-sm tabular-nums disabled:bg-sunken disabled:text-ink-faint';
</script>

<div class="space-y-2">
	<div class="flex items-baseline gap-2">
		<label for="{idPrefix}-duration" class="sr-only">Duration</label>
		<input
			id="{idPrefix}-duration"
			type="text"
			inputmode="text"
			autocomplete="off"
			value={shownDuration}
			onfocus={beginEditing}
			oninput={(event) => {
				beginEditing();
				typedText = event.currentTarget.value;
				durationError = '';
			}}
			onblur={confirmDuration}
			onkeydown={handleDurationKeydown}
			{disabled}
			aria-invalid={message !== ''}
			aria-describedby={message ? `${idPrefix}-times-message` : undefined}
			class="w-32 border-0 border-b-2 border-pine-600 bg-transparent px-0 py-0.5 text-3xl font-bold text-pine-700 tabular-nums focus:border-focus focus:ring-0 focus:outline-none disabled:border-transparent disabled:text-ink-muted"
			data-testid="{idPrefix}-duration"
		/>
		{#if suffix}<span class="text-sm text-ink-muted">{suffix}</span>{/if}
	</div>
	<div class="flex items-center gap-2 text-sm">
		<label for="{idPrefix}-from" class="text-ink-muted">From</label>
		<input
			id="{idPrefix}-from"
			type="text"
			inputmode="text"
			autocomplete="off"
			maxlength="5"
			placeholder="HH:MM"
			value={clockOf(from)}
			oninput={(event) => handleClockChange(event, onFrom, () => from)}
			onchange={(event) => handleClockChange(event, onFrom, () => from)}
			onkeydown={handleClockKeydown}
			disabled={disabled || !fromEditable}
			class="w-32 {inputClass}"
			data-testid="{idPrefix}-from"
		/>
		<label for="{idPrefix}-to" class="ml-auto text-ink-muted">To</label>
		{#if to === null}
			<input id="{idPrefix}-to" type="text" value="Now" disabled class="w-32 {inputClass}" data-testid="{idPrefix}-to" />
		{:else}
			<input
				id="{idPrefix}-to"
				type="text"
				inputmode="text"
				autocomplete="off"
				maxlength="5"
				placeholder="HH:MM"
				value={clockOf(to)}
				oninput={(event) => handleClockChange(event, onTo, () => to)}
				onchange={(event) => handleClockChange(event, onTo, () => to)}
				onkeydown={handleClockKeydown}
				disabled={disabled || !toEditable}
				class="w-32 {inputClass}"
				data-testid="{idPrefix}-to"
			/>
		{/if}
	</div>
	{#if message}
		<p id="{idPrefix}-times-message" class="text-xs text-rust-600" role="alert" data-testid="{idPrefix}-times-error">{message}</p>
	{/if}
</div>
