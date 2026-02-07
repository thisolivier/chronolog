<script lang="ts">
	import TimerDisplay from './TimerDisplay.svelte';
	import TimerCompletionForm from './TimerCompletionForm.svelte';
	import {
		fetchTimerStatus,
		apiStartTimer,
		apiStopTimer,
		apiSaveTimer,
		apiDiscardTimer,
		calculateElapsedFromStartTime
	} from './timer-api';

	type TimerState = 'idle' | 'running' | 'paused' | 'stopped';

	let timerState: TimerState = $state('idle');
	let entryId = $state('');
	let startTime = $state('');
	let endTime = $state('');
	let elapsedSeconds = $state(0);
	let isLoading = $state(true);
	let errorMessage = $state('');

	/** Check for existing running timer on mount */
	async function checkExistingTimer() {
		try {
			const data = await fetchTimerStatus();
			if (data.timer) {
				entryId = data.timer.id;
				startTime = data.timer.startTime || '';
				if (data.timer.endTime) {
					endTime = data.timer.endTime;
					elapsedSeconds = data.timer.durationMinutes * 60;
					timerState = 'stopped';
				} else {
					elapsedSeconds = startTime ? calculateElapsedFromStartTime(startTime) : 0;
					timerState = 'running';
				}
			}
		} catch {
			// Silently fail — user can start a new timer
		}
		isLoading = false;
	}

	$effect(() => {
		checkExistingTimer();
	});

	// Timer tick — runs every second when running and not paused
	$effect(() => {
		if (timerState !== 'running') return;

		const intervalId = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);

		return () => clearInterval(intervalId);
	});

	async function handleStart() {
		errorMessage = '';
		try {
			const timerEntry = await apiStartTimer();
			entryId = timerEntry.id;
			startTime = timerEntry.startTime || '';
			elapsedSeconds = 0;
			timerState = 'running';
		} catch (caughtError) {
			errorMessage =
				caughtError instanceof Error ? caughtError.message : 'Failed to start timer';
		}
	}

	function handlePause() {
		timerState = 'paused';
	}

	function handleResume() {
		timerState = 'running';
	}

	async function handleStop() {
		try {
			const stoppedEntry = await apiStopTimer();
			endTime = stoppedEntry.endTime || '';
			elapsedSeconds = stoppedEntry.durationMinutes * 60;
			timerState = 'stopped';
		} catch {
			errorMessage = 'Failed to stop timer';
		}
	}

	async function handleSave(data: {
		contractId: string;
		deliverableId: string;
		workTypeId: string;
		description: string;
	}) {
		try {
			await apiSaveTimer({ entryId, ...data });
			resetTimer();
		} catch {
			errorMessage = 'Failed to save time entry';
		}
	}

	async function handleDiscard() {
		try {
			await apiDiscardTimer(entryId);
		} catch {
			// Best effort discard
		}
		resetTimer();
	}

	function resetTimer() {
		timerState = 'idle';
		entryId = '';
		startTime = '';
		endTime = '';
		elapsedSeconds = 0;
		errorMessage = '';
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	{#if isLoading}
		<div class="py-2 text-center text-sm text-gray-400">Loading timer...</div>
	{:else if timerState === 'idle'}
		<button
			onclick={handleStart}
			class="w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
		>
			Start Timer
		</button>
	{:else if timerState === 'running' || timerState === 'paused'}
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<TimerDisplay {elapsedSeconds} isPaused={timerState === 'paused'} />
				<div class="flex gap-1.5">
					{#if timerState === 'running'}
						<button
							onclick={handlePause}
							class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
						>
							Pause
						</button>
					{:else}
						<button
							onclick={handleResume}
							class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
						>
							Resume
						</button>
					{/if}
					<button
						onclick={handleStop}
						class="rounded-md bg-red-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-red-700"
					>
						Stop
					</button>
				</div>
			</div>
			<div class="text-xs text-gray-500">
				Started: {startTime ? startTime.substring(0, 5) : '--:--'}
			</div>
		</div>
	{:else if timerState === 'stopped'}
		<TimerCompletionForm
			{entryId}
			{startTime}
			{endTime}
			{elapsedSeconds}
			onSave={handleSave}
			onDiscard={handleDiscard}
		/>
	{/if}

	{#if errorMessage}
		<div class="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-600">
			{errorMessage}
		</div>
	{/if}
</div>
