<script lang="ts">
	/**
	 * The running timer's "Started" time, editable (sprint 041-CL). Enter or Save moves the start,
	 * Escape puts the old value back. A start before the end of another entry asks first; the date
	 * shows only when the timer started on another day (it crossed midnight).
	 */
	import { localDateString } from './local-date';
	import { localTimerStartProblem, toTimeInputValue, type StartChangeResult } from './timer-start-edit';

	let {
		startTime,
		startDate,
		onChangeStart
	}: {
		/** `HH:MM:SS` */
		startTime: string;
		/** `YYYY-MM-DD` */
		startDate: string;
		onChangeStart: (start: { date: string; startTime: string }, confirmed: boolean) => Promise<StartChangeResult>;
	} = $props();

	let editedTime = $state('');
	let editedDate = $state('');
	let errorMessage = $state('');
	let overlapMessage = $state('');
	let isSaving = $state(false);
	let timeInput: HTMLInputElement | undefined = $state();

	// Follow the timer (a reload, another device, a save) whenever its start changes
	$effect(() => {
		editedTime = toTimeInputValue(startTime);
		editedDate = startDate;
	});

	const crossesMidnight = $derived(Boolean(startDate) && startDate !== localDateString());
	const isChanged = $derived(editedTime !== toTimeInputValue(startTime) || editedDate !== startDate);

	function cancelEditing() {
		editedTime = toTimeInputValue(startTime);
		editedDate = startDate;
		errorMessage = '';
		overlapMessage = '';
	}

	async function saveStart(confirmed = false) {
		if (isSaving) return;
		errorMessage = '';
		if (!isChanged) {
			overlapMessage = '';
			return;
		}
		const problem = localTimerStartProblem(editedDate, editedTime);
		if (problem) {
			errorMessage = problem;
			return;
		}
		isSaving = true;
		try {
			const result = await onChangeStart({ date: editedDate, startTime: `${editedTime}:00` }, confirmed);
			if (result.outcome === 'overlap') {
				overlapMessage = result.message;
			} else if (result.outcome === 'error') {
				overlapMessage = '';
				errorMessage = result.message;
			} else {
				overlapMessage = '';
			}
		} finally {
			isSaving = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void saveStart(Boolean(overlapMessage));
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			cancelEditing();
			timeInput?.blur();
		}
	}

	const inputClass =
		'rounded border border-line px-1 py-0.5 text-xs text-ink-soft tabular-nums focus:border-focus focus:ring-1 focus:ring-focus focus:outline-none';
</script>

<div class="text-xs text-ink-faint" data-testid="timer-start-field">
	<div class="flex flex-wrap items-center gap-1.5">
		<label for="timer-start-time">Started</label>
		{#if crossesMidnight}
			<input
				type="date"
				aria-label="Start date"
				bind:value={editedDate}
				onkeydown={handleKeydown}
				class={inputClass}
				data-testid="timer-start-date"
			/>
		{/if}
		<input
			id="timer-start-time"
			type="time"
			bind:this={timeInput}
			bind:value={editedTime}
			onkeydown={handleKeydown}
			class={inputClass}
			data-testid="timer-start-time"
		/>
		{#if isChanged && !overlapMessage}
			<button
				type="button"
				onclick={() => saveStart(false)}
				disabled={isSaving}
				class="rounded btn-primary px-2 py-0.5 text-xs font-medium disabled:opacity-50"
			>Save</button>
			<button type="button" onclick={cancelEditing} class="px-1 text-xs text-ink-faint hover:text-ink-soft">Cancel</button>
		{/if}
	</div>
	{#if errorMessage}
		<p class="mt-1 text-rust-600" role="alert" data-testid="timer-start-error">{errorMessage}</p>
	{/if}
	{#if overlapMessage}
		<div class="mt-1 rounded border border-ochre-300 bg-ochre-50 p-2 text-ochre-900" role="alert" data-testid="timer-start-overlap">
			<p>{overlapMessage}</p>
			<div class="mt-1.5 flex gap-2">
				<button
					type="button"
					onclick={() => saveStart(true)}
					disabled={isSaving}
					class="rounded bg-ochre-600 px-2 py-0.5 font-medium text-on-accent hover:bg-ochre-700 disabled:opacity-50"
				>Save anyway</button>
				<button type="button" onclick={cancelEditing} class="rounded btn-secondary px-2 py-0.5">Cancel</button>
			</div>
		</div>
	{/if}
</div>
