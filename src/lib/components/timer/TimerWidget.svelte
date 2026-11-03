<script lang="ts">
	import TimerDisplay from './TimerDisplay.svelte';
	import TimerCompletionForm from './TimerCompletionForm.svelte';
	import ContractSelect from './ContractSelect.svelte';
	import AddTimeEntryModal from './AddTimeEntryModal.svelte';
	import { getDataService } from '$lib/services/context';
	import { getTimerStateContext } from '$lib/stores/timer-state.svelte';
	import { calculateElapsedFromStartTime, type TimerSaveData } from './timer-api';
	import { formatContractLabel } from './contract-label';
	import { localDateString } from './local-date';
	import { registerSidebarTimerWidget } from './timer-widget-registry.svelte';
	import { dispatchTimeEntrySaved } from '$lib/components/weekly/time-entry-events';
	import type { ContractOption } from '$lib/services/types';

	let {
		placement = 'sidebar',
		addEntryDate = undefined
	}: {
		/** 'footer' is the phone timesheet's copy, shown only while the sidebar is not mounted */
		placement?: 'sidebar' | 'footer';
		/** Date the Add Entry modal opens on (the timesheet passes the selected day) */
		addEntryDate?: string;
	} = $props();

	$effect(() => {
		if (placement === 'sidebar') return registerSidebarTimerWidget();
	});

	const dataService = getDataService();
	const sharedTimerState = getTimerStateContext();

	// There is no paused state: the server cannot store paused time yet, so pause was removed
	type TimerState = 'idle' | 'running' | 'stopped';

	let timerState: TimerState = $state('idle');
	let entryId = $state('');
	let startTime = $state('');
	let timerDate = $state('');
	let endTime = $state('');
	let elapsedSeconds = $state(0);
	let isLoading = $state(true);
	let errorMessage = $state('');

	// Draft fields for running/paused state
	let draftContractId = $state('');
	let draftDescription = $state('');
	let descriptionDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Modal state
	let showAddEntryModal = $state(false);

	// Contract list for looking up name/color for the shared timer state
	let contractList: ContractOption[] = $state([]);

	async function loadContractList() {
		try {
			contractList = await dataService.getContracts();
		} catch {
			// Best effort -- list will remain empty
		}
	}

	$effect(() => {
		loadContractList();
	});

	function findSelectedContract(): ContractOption | undefined {
		return contractList.find((contract) => contract.id === draftContractId);
	}

	async function checkExistingTimer() {
		try {
			const data = await dataService.getTimerStatus();
			if (data.timer) {
				entryId = data.timer.id;
				startTime = data.timer.startTime || '';
				timerDate = data.timer.date ?? '';
				// Restore the draft the server already holds, before the state switch renders
				// the running controls or the completion form (both read these as initial values)
				draftContractId = data.timer.contractId ?? '';
				draftDescription = data.timer.description ?? '';
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
			// Silently fail -- user can start a new timer
		}
		isLoading = false;
	}

	$effect(() => {
		checkExistingTimer();
	});

	// Timer tick -- runs every second while running
	$effect(() => {
		if (timerState !== 'running') return;
		const intervalId = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);
		return () => clearInterval(intervalId);
	});

	// When draft contract changes, immediately persist to server
	$effect(() => {
		if (!entryId || !draftContractId) return;
		if (timerState !== 'running') return;
		dataService.updateTimeEntry(entryId, { contractId: draftContractId }).catch(() => {
			// Best effort -- silently fail
		});
	});

	// Sync local timer state to the shared context so TimerIndicator can read it
	$effect(() => {
		if (timerState === 'running') {
			const selectedContract = findSelectedContract();
			sharedTimerState.update({
				status: timerState,
				elapsedSeconds: elapsedSeconds,
				description: draftDescription,
				contractName: selectedContract
					? formatContractLabel(selectedContract.clientName, selectedContract.name)
					: '',
				clientColorIndex: selectedContract?.clientColorIndex ?? 0
			});
		} else if (timerState === 'idle') {
			sharedTimerState.reset();
		} else if (timerState === 'stopped') {
			sharedTimerState.update({ status: 'stopped' });
		}
	});

	// Debounced description update
	function handleDescriptionInput() {
		if (descriptionDebounceTimer) {
			clearTimeout(descriptionDebounceTimer);
		}
		descriptionDebounceTimer = setTimeout(() => {
			if (entryId && timerState === 'running') {
				dataService.updateTimeEntry(entryId, { description: draftDescription }).catch(() => {
					// Best effort -- silently fail
				});
			}
		}, 1500);
	}

	async function handleStart() {
		errorMessage = '';
		try {
			const timerEntry = await dataService.startTimer();
			entryId = timerEntry.id;
			startTime = timerEntry.startTime || '';
			timerDate = timerEntry.date ?? localDateString();
			elapsedSeconds = 0;
			draftContractId = '';
			draftDescription = '';
			timerState = 'running';
		} catch (caughtError) {
			errorMessage =
				caughtError instanceof Error ? caughtError.message : 'Failed to start timer';
		}
	}

	async function handleStop() {
		// Flush any pending description update
		if (descriptionDebounceTimer) {
			clearTimeout(descriptionDebounceTimer);
			if (entryId && draftDescription) {
				try {
					await dataService.updateTimeEntry(entryId, { description: draftDescription });
				} catch {
					// Best effort
				}
			}
		}

		try {
			const stoppedEntry = await dataService.stopTimer();
			// Display the server's view of the entry: its end time, its rounded-up duration
			// (never 0m), and the draft contract/description it holds
			startTime = stoppedEntry.startTime || startTime;
			endTime = stoppedEntry.endTime || '';
			elapsedSeconds = stoppedEntry.durationMinutes * 60;
			draftContractId = draftContractId || stoppedEntry.contractId || '';
			draftDescription = draftDescription || stoppedEntry.description || '';
			timerState = 'stopped';
		} catch {
			errorMessage = 'Failed to stop timer';
		}
	}

	/** Throws on failure so the completion form can show the message next to its buttons */
	async function handleSave(data: TimerSaveData) {
		const savedEntryId = entryId;
		const savedDate = timerDate || localDateString();
		await dataService.saveTimer({ entryId, ...data });
		resetTimer();
		// A timer entry is dated the local day it was started
		dispatchTimeEntrySaved({ entryId: savedEntryId, date: savedDate });
	}

	async function handleDiscard() {
		try {
			await dataService.discardTimer(entryId);
		} catch {
			// Best effort discard
		}
		resetTimer();
	}

	function resetTimer() {
		timerState = 'idle';
		entryId = '';
		startTime = '';
		timerDate = '';
		endTime = '';
		elapsedSeconds = 0;
		errorMessage = '';
		draftContractId = '';
		draftDescription = '';
		sharedTimerState.reset();
		if (descriptionDebounceTimer) {
			clearTimeout(descriptionDebounceTimer);
		}
	}

	function handleAddEntryCreated(created: { entryId: string; date: string }) {
		showAddEntryModal = false;
		dispatchTimeEntrySaved(created);
	}
</script>

<div
	class={placement === 'footer'
		? 'border-t border-stone-200 bg-white px-4 py-3'
		: 'rounded-lg border border-stone-200 bg-white p-3 shadow-sm'}
	data-testid="timer-widget-{placement}"
>
	{#if isLoading}
		<div class="py-2 text-center text-sm text-stone-400">Loading timer...</div>
	{:else if timerState === 'idle'}
		<div class="flex gap-2">
			<button
				onclick={handleStart}
				class="flex-1 rounded-md bg-green-600 px-2 py-2.5 text-sm font-medium whitespace-nowrap text-white hover:bg-green-700"
			>
				Start Timer
			</button>
			<button
				onclick={() => (showAddEntryModal = true)}
				class="flex-1 rounded-md border border-stone-300 bg-white px-2 py-2.5 text-sm font-medium whitespace-nowrap text-stone-700 hover:bg-stone-50"
			>
				Add Entry
			</button>
		</div>
	{:else if timerState === 'running'}
		<div class="space-y-3">
			<div class="flex items-center justify-between gap-2">
				<TimerDisplay {elapsedSeconds} isPaused={false} />
				<button
					onclick={handleStop}
					class="rounded-md bg-red-600 px-3 py-1 text-sm font-medium whitespace-nowrap text-white hover:bg-red-700"
				>
					Stop
				</button>
			</div>
			<div class="text-xs text-stone-500">
				Started: {startTime ? startTime.substring(0, 5) : '--:--'}
			</div>

			<!-- Draft contract and description while timer is running -->
			<div class="space-y-2">
				<div>
					<label for="draft-contract" class="block text-xs font-medium text-stone-600">
						Contract
					</label>
					<div class="mt-0.5">
						<ContractSelect id="draft-contract" bind:selectedContractId={draftContractId} compact />
					</div>
				</div>
				<div>
					<label for="draft-description" class="block text-xs font-medium text-stone-600">
						Description
					</label>
					<textarea
						id="draft-description"
						bind:value={draftDescription}
						oninput={handleDescriptionInput}
						rows="2"
						class="mt-0.5 block w-full rounded border border-stone-300 px-1.5 py-1 text-xs shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="What are you working on?"
					></textarea>
				</div>
			</div>
		</div>
	{:else if timerState === 'stopped'}
		<TimerCompletionForm
			{startTime}
			{endTime}
			{elapsedSeconds}
			initialContractId={draftContractId}
			initialDescription={draftDescription}
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

{#if showAddEntryModal}
	<AddTimeEntryModal
		initialDate={addEntryDate}
		onCreated={handleAddEntryCreated}
		onClose={() => (showAddEntryModal = false)}
	/>
{/if}
