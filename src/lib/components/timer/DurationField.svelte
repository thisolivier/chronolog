<script lang="ts">
	import {
		parseDuration,
		formatMinutes,
		DURATION_PLACEHOLDER
	} from '$lib/utils/duration';

	/**
	 * Text input for a duration or time range, shared by every entry form. Shows what the
	 * text will be read as ("= 1h 30m"), a warning for long entries, and an error message
	 * passed in by the form (usually after a submit attempt).
	 */
	let {
		value = $bindable(''),
		errorMessage = '',
		id = undefined,
		compact = false,
		autofocus = false,
		align = 'left',
		onkeydown = undefined,
		onblur = undefined,
		oninput = undefined
	}: {
		value: string;
		errorMessage?: string;
		id?: string;
		compact?: boolean;
		autofocus?: boolean;
		align?: 'left' | 'right';
		onkeydown?: (event: KeyboardEvent) => void;
		onblur?: (event: FocusEvent) => void;
		oninput?: (event: Event) => void;
	} = $props();

	let inputElement: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (autofocus) inputElement?.focus();
	});

	const parsedValue = $derived(value.trim() ? parseDuration(value) : null);
	const previewText = $derived.by(() => {
		if (!parsedValue || !parsedValue.ok) return '';
		const formatted = formatMinutes(parsedValue.durationMinutes);
		// Only worth showing when it says something the user did not type
		return formatted.replace(' ', '') === value.trim().replace(/\s/g, '') ? '' : `= ${formatted}`;
	});
	const warningText = $derived(parsedValue && parsedValue.ok ? (parsedValue.warning ?? '') : '');
	const hasError = $derived(errorMessage !== '');
	const messageId = $derived(id ? `${id}-message` : undefined);

	const sizeClasses = $derived(
		compact ? 'rounded px-1.5 py-1 text-sm' : 'rounded-md px-2 py-1.5 text-sm shadow-sm'
	);
</script>

<input
	bind:this={inputElement}
	{id}
	type="text"
	inputmode="text"
	autocomplete="off"
	bind:value
	{onkeydown}
	{onblur}
	{oninput}
	aria-invalid={hasError}
	aria-describedby={messageId}
	placeholder={DURATION_PLACEHOLDER}
	class="block w-full border font-medium tabular-nums focus:ring-1 focus:outline-none {sizeClasses}
		{align === 'right' ? 'text-right' : ''}
		{hasError
		? 'border-red-400 focus:border-red-500 focus:ring-red-500'
		: 'border-stone-300 focus:border-blue-500 focus:ring-blue-500'}"
/>
{#if hasError}
	<p id={messageId} class="mt-1 text-xs text-red-600" role="alert">{errorMessage}</p>
{:else if warningText}
	<p id={messageId} class="mt-1 text-xs text-amber-700">{warningText}</p>
{:else if previewText}
	<p id={messageId} class="mt-1 text-xs text-stone-400 tabular-nums">{previewText}</p>
{/if}
