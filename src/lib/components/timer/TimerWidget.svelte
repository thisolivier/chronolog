<script lang="ts">
	import { isOfflineError } from '$lib/offline/replay-transport';
	import { startChangeResultFromError, type StartChangeResult } from './timer-start-edit';
	import TimerCompletionForm from './TimerCompletionForm.svelte';
	import TimerRunningPanel from './TimerRunningPanel.svelte';
	import AddTimeEntryModal from './AddTimeEntryModal.svelte';
	import { getDataService } from '$lib/services/context';
	import { getTimerStateContext } from '$lib/stores/timer-state.svelte';
	import {
		calculateElapsedFromStartTime,
		secondsBetweenTimes,
		type TimerSaveData
	} from './timer-api';
	import { clearPendingTimer, readPendingTimer, writePendingTimer } from './pending-timer';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { untrack } from 'svelte';
	import { formatContractLabel } from './contract-label';
	import { localDateString, localTimeString } from './local-date';
	import {
		announceCaptureChange,
		latestCaptureChange,
		registerTimerWidget,
		type TimerWidgetPlacement
	} from './timer-widget-registry.svelte';
	import { describeTimerConflict, timerConflictFrom } from './save-error';
	import { splitHandlerFor } from './split-entry';
	import TimerIdentityHeader from './TimerIdentityHeader.svelte';
	import { captureDraft } from '$lib/stores/capture-draft.svelte';
	import { captureKeyFor, intervalKeyFor } from '$lib/stores/capture-draft';
	import { formatDurationInput } from '$lib/utils/duration';
	import { readTimerCompact, writeTimerCompact } from './timer-compact-preference';
	import { dispatchTimeEntrySaved } from '$lib/components/weekly/time-entry-events';
	import { getWeekDates } from '$lib/utils/iso-week';
	import type { ContractOption } from '$lib/services/types';
	import { appendWikiLinkToDescription } from '$lib/components/weekly/attach-note';

	let {
		placement = 'sidebar',
		addEntryDate = undefined,
		onLeave = undefined
	}: {
		/**
		 * 'footer' is the phone timesheet's copy, shown only while the sidebar is not mounted;
		 * 'screen' is the phone's focused capture screen (PhoneCaptureScreen, sprint 055-DR)
		 */
		placement?: TimerWidgetPlacement;
		/** Date the Add Entry modal opens on (the timesheet passes the selected day) */
		addEntryDate?: string;
		/** The capture screen closes when the user leaves it: Save, Discard, Add note's navigation */
		onLeave?: () => void;
	} = $props();

	$effect(() => registerTimerWidget(placement));

	// Another mounted widget changed the capture (the phone capture screen over the timesheet
	// footer): re-read it, so the copy underneath never shows a stale state (sprint 055-DR)
	const widgetId = Math.random().toString(36).slice(2);
	let lastSeenChangeVersion = untrack(() => latestCaptureChange().version);
	$effect(() => {
		const change = latestCaptureChange();
		if (change.version === lastSeenChangeVersion) return;
		lastSeenChangeVersion = change.version;
		if (change.sourceWidgetId !== widgetId) untrack(() => reloadFromServer());
	});
	function announceChange() {
		lastSeenChangeVersion += 1;
		announceCaptureChange(widgetId);
	}

	// Answers that arrive after unmount must not navigate or close a screen reopened since
	let isMounted = true;
	$effect(() => () => {
		isMounted = false;
	});

	const isScreen = $derived(placement === 'screen');
	const splitHandler = splitHandlerFor();

	const dataService = getDataService();
	const sharedTimerState = getTimerStateContext();
	const navigation = getNavigationContext();

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

	// Collapse (SH-06): a presentation of this same widget, desktop / tablet sidebar only. The body
	// stays mounted (hidden) while compact, and the completion fields live in the capture store.
	let compactPreference = $state(readTimerCompact());
	const canCollapse = $derived(placement === 'sidebar' && navigation.layoutMode !== 'mobile');
	const isCompact = $derived.by(() => canCollapse && compactPreference && timerState !== 'idle' && !isLoading);
	function toggleCompact() {
		compactPreference = !compactPreference;
		writeTimerCompact(compactPreference);
	}

	// "Change" reveals the contract select (TC-02); the chevron never chooses a contract
	let isChangingContract = $state(false);
	function startChangingContract() {
		isChangingContract = true;
	}

	// Rule 5, create from context: the modal opens on the contract being viewed (notes mode) and,
	// in the timesheet, on the week being viewed (today when today is in that week)
	const modalContractId = $derived(navigation.isNotesMode ? (navigation.selectedContractId ?? '') : '');
	const modalDate = $derived.by(() => {
		if (addEntryDate) return addEntryDate;
		if (!navigation.isTimeEntriesMode || !navigation.selectedWeek) return undefined;
		const today = localDateString();
		const weekDates = getWeekDates(navigation.selectedWeek);
		return weekDates.includes(today) ? today : weekDates[0];
	});

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

	// The capture's identity: the running draft's contract, or the one chosen in the completion form
	const identityContractId = $derived.by(() =>
		timerState === 'stopped' ? captureDraft.fields.contractId : draftContractId
	);
	const identityContract = $derived(contractList.find((contract) => contract.id === identityContractId));

	/** Open (or resume) the completion fields for the capture that just stopped */
	function openCompletion() {
		const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
		const measuredTimeText = formatDurationInput(durationMinutes, startTime || null, endTime || null);
		// The interval key: a split, resume or move elsewhere changes it, which resets the time text
		const intervalKey = intervalKeyFor({ date: timerDate, startTime, endTime, durationMinutes });
		captureDraft.open(captureKeyFor({ entryId, date: timerDate, startTime }), intervalKey, {
			contractId: draftContractId,
			deliverableId: '',
			workTypeId: '',
			description: draftDescription,
			timeText: measuredTimeText,
			measuredTimeText
		});
	}

	/*
	 * The timer never picks a contract by itself. Start Timer uses the contract open in
	 * the sidebar (notes mode) if there is one; otherwise it runs with no contract, in the
	 * browser only (pending-timer.ts), and the server draft is created, with the original
	 * start time, as soon as the user picks a contract. `entryId` is empty while pending.
	 */
	let isCreatingServerDraft = false;

	/** Read the capture; false when the status could not be read and `keepOnFailure` left state alone */
	async function checkExistingTimer(keepOnFailure = false): Promise<boolean> {
		try {
			const data = await dataService.getTimerStatus();
			if (data.timer) {
				clearPendingTimer();
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
					openCompletion();
				} else {
					elapsedSeconds = startTime ? calculateElapsedFromStartTime(startTime, timerDate) : 0;
					timerState = 'running';
				}
			} else if (!restorePendingTimer()) {
				// The server and this browser hold no capture: any completion fields are stale
				captureDraft.clear();
			}
		} catch {
			if (keepOnFailure) {
				isLoading = false;
				return false;
			}
			restorePendingTimer();
		}
		isLoading = false;
		return true;
	}

	/** Restore the browser-only timer; false when there is none */
	function restorePendingTimer(): boolean {
		const pendingTimer = readPendingTimer();
		if (!pendingTimer) return false;
		entryId = '';
		startTime = pendingTimer.startTime;
		timerDate = pendingTimer.date;
		draftContractId = '';
		draftDescription = pendingTimer.description;
		if (pendingTimer.endTime) {
			endTime = pendingTimer.endTime;
			elapsedSeconds = secondsBetweenTimes(pendingTimer.startTime, pendingTimer.endTime);
			timerState = 'stopped';
			openCompletion();
		} else {
			elapsedSeconds = calculateElapsedFromStartTime(pendingTimer.startTime, pendingTimer.date);
			timerState = 'running';
		}
		return true;
	}

	function savePendingTimer() {
		writePendingTimer({
			date: timerDate,
			startTime,
			description: draftDescription,
			endTime: timerState === 'stopped' ? endTime : undefined
		});
	}

	/** Create the server draft for a running timer, keeping its real (local) start */
	async function createServerDraft(contractId: string) {
		if (isCreatingServerDraft || entryId) return;
		isCreatingServerDraft = true;
		try {
			const timerEntry = await dataService.startTimer(contractId, { date: timerDate, startTime });
			entryId = timerEntry.id;
			clearPendingTimer();
			if (draftDescription) {
				await dataService.updateTimeEntry(timerEntry.id, { description: draftDescription });
			}
		} catch (caughtError) {
			if (isOfflineError(caughtError)) {
				// Offline (sprint 045-CL): the timer runs in the browser; saving it queues the entry
				savePendingTimer();
				return;
			}
			errorMessage =
				caughtError instanceof Error ? caughtError.message : 'Failed to start timer';
		} finally {
			isCreatingServerDraft = false;
		}
	}

	$effect(() => {
		checkExistingTimer();
	});

	// Timer tick -- runs every second while running. Recomputed from the start each time, so a
	// throttled background tab or a sleeping laptop never makes the clock fall behind.
	$effect(() => {
		if (timerState !== 'running') return;
		const intervalId = setInterval(() => {
			elapsedSeconds = startTime ? calculateElapsedFromStartTime(startTime, timerDate) : elapsedSeconds + 1;
		}, 1000);
		return () => clearInterval(intervalId);
	});

	// A contract picked while running: create the server draft, or move the draft to it
	$effect(() => {
		const chosenContractId = draftContractId;
		if (!chosenContractId || timerState !== 'running') return;
		const existingEntryId = entryId;
		untrack(() => {
			isChangingContract = false;
			if (!existingEntryId) {
				createServerDraft(chosenContractId);
				return;
			}
			dataService.updateTimeEntry(existingEntryId, { contractId: chosenContractId }).catch(() => {
				// Best effort -- the completion form saves the contract again
			});
		});
	});

	// Sync local timer state to the shared context so TimerIndicator can read it
	$effect(() => {
		if (timerState === 'idle') {
			sharedTimerState.reset();
			return;
		}
		const contract = identityContract;
		sharedTimerState.update({
			status: timerState,
			elapsedSeconds: elapsedSeconds,
			description: timerState === 'stopped' ? captureDraft.fields.description : draftDescription,
			contractName: contract ? formatContractLabel(contract.clientName, contract.name) : '',
			clientColorIndex: contract?.clientColorIndex ?? 0,
			contractShortCode: contract?.clientShortCode ?? '',
			contractTitle: contract?.name ?? '',
			clientName: contract?.clientName ?? '',
			startTime: timerState === 'running' ? startTime : '',
			startDate: timerState === 'running' ? timerDate : ''
		});
	});

	// Debounced description update (server draft), or straight to storage while pending
	function handleDescriptionInput() {
		if (!entryId) {
			savePendingTimer();
			return;
		}
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

	/**
	 * Attach note while running: a new note on the timer's contract, `[[NOTE_ID]]` added to the
	 * description (saved now, not debounced), then the main view moves to the note, ready to type.
	 */
	async function attachNoteToRunningTimer() {
		const contractId = draftContractId;
		if (!contractId) return;
		errorMessage = '';
		try {
			const note = await dataService.createNote(contractId, {});
			draftDescription = appendWikiLinkToDescription(draftDescription, note.id);
			if (descriptionDebounceTimer) clearTimeout(descriptionDebounceTimer);
			if (entryId) await dataService.updateTimeEntry(entryId, { description: draftDescription });
			else savePendingTimer();
			const clientId = findSelectedContract()?.clientId ?? '';
			navigation.openNote(note.id, contractId, clientId, { focusEditor: 'new-note' });
			onLeave?.();
		} catch (error) {
			console.error('Could not attach a note to the timer:', error);
			errorMessage = "Couldn't attach a note";
		}
	}

	async function handleStart() {
		errorMessage = '';
		// Only a contract the user is looking at counts as chosen; never the first in a list
		const viewedContractId = navigation.isNotesMode ? (navigation.selectedContractId ?? '') : '';
		const now = new Date();
		entryId = '';
		startTime = localTimeString(now);
		timerDate = localDateString(now);
		endTime = '';
		elapsedSeconds = 0;
		draftDescription = '';
		draftContractId = viewedContractId;
		timerState = 'running';
		if (viewedContractId) {
			await createServerDraft(viewedContractId);
		} else {
			savePendingTimer();
		}
		announceChange();
	}

	/**
	 * Move the running timer's start (sprint 041-CL): on the server for a draft, else in the
	 * browser's pending timer. The clock, the top-bar pill and the menu bar follow `elapsedSeconds`.
	 */
	async function handleChangeStart(
		start: { date: string; startTime: string },
		confirmed: boolean
	): Promise<StartChangeResult> {
		if (!entryId) {
			startTime = start.startTime;
			timerDate = start.date;
			elapsedSeconds = calculateElapsedFromStartTime(startTime, timerDate);
			savePendingTimer();
			return { outcome: 'saved' };
		}
		try {
			const movedTimer = await dataService.adjustTimerStart(start, { confirmed });
			startTime = movedTimer.startTime || start.startTime;
			timerDate = movedTimer.date ?? start.date;
			elapsedSeconds = calculateElapsedFromStartTime(startTime, timerDate);
			return { outcome: 'saved' };
		} catch (caughtError) {
			return startChangeResultFromError(caughtError);
		}
	}

	async function handleStop() {
		if (!entryId) {
			// Still no contract: stop in the browser; the completion form asks for one
			endTime = localTimeString();
			elapsedSeconds = Math.max(60, secondsBetweenTimes(startTime, endTime));
			timerState = 'stopped';
			savePendingTimer();
			openCompletion();
			announceChange();
			return;
		}

		// Flush any pending description update
		if (descriptionDebounceTimer) {
			clearTimeout(descriptionDebounceTimer);
			if (draftDescription) {
				try {
					await dataService.updateTimeEntry(entryId, { description: draftDescription });
				} catch {
					// Best effort
				}
			}
		}

		try {
			const stoppedEntry = await dataService.stopTimer();
			// The server's end time and rounded-up duration (never 0m). The contract shown in
			// the completion form is exactly what the user chose (draftContractId), never a guess.
			startTime = stoppedEntry.startTime || startTime;
			endTime = stoppedEntry.endTime || '';
			elapsedSeconds = stoppedEntry.durationMinutes * 60;
			draftDescription = draftDescription || stoppedEntry.description || '';
			timerState = 'stopped';
			isChangingContract = false;
			openCompletion();
			announceChange();
		} catch {
			errorMessage = 'Failed to stop timer';
		}
	}

	function expectedStartedAt(): string | undefined {
		return timerDate && startTime ? `${timerDate}T${startTime}` : undefined;
	}

	/** Throws on failure so the completion form can show the message next to its buttons */
	/**
	 * Save or Discard: one at a time across every mounted widget (captureDraft.isResolving), so a
	 * Back and reopen mid-save cannot resolve the same capture twice
	 */
	async function resolveCapture(resolve: () => Promise<void>) {
		if (captureDraft.isResolving) return;
		captureDraft.isResolving = true;
		try {
			await resolve();
		} finally {
			captureDraft.isResolving = false;
		}
	}

	/** Throws on failure so the completion form can show the message next to its buttons */
	function handleSave(data: TimerSaveData) {
		return resolveCapture(() => saveCapture(data));
	}

	async function saveCapture(data: TimerSaveData) {
		const savedDate = timerDate || localDateString();
		let savedEntryId = entryId;
		if (entryId) {
			// The start this widget shows: the server refuses the save if the draft moved or was split elsewhere
			try {
				await dataService.saveTimer({ entryId, ...data, expectedStartedAt: expectedStartedAt() });
			} catch (caughtError) {
				const conflict = timerConflictFrom(caughtError);
				if (!conflict) throw caughtError;
				// Stale capture: never retry blindly; show the server's current state and say why
				await reloadFromServer(describeTimerConflict(conflict, 'save'));
				announceChange();
				return;
			}
		} else {
			// Never reached the server: create the entry from the browser's timer
			const timeWasAdjusted = data.durationMinutes !== undefined;
			const created = await dataService.createTimeEntry({
				date: savedDate,
				contractId: data.contractId,
				deliverableId: data.deliverableId || null,
				workTypeId: data.workTypeId || null,
				description: data.description.trim() || undefined,
				durationMinutes: timeWasAdjusted
					? (data.durationMinutes as number)
					: Math.max(1, Math.ceil(elapsedSeconds / 60)),
				startTime: (timeWasAdjusted ? data.startTime : startTime) || undefined,
				endTime: (timeWasAdjusted ? data.endTime : endTime) || undefined
			});
			savedEntryId = created.id;
		}
		resetTimer();
		announceChange();
		// A timer entry is dated the local day it was started; the view follows it there
		dispatchTimeEntrySaved({ entryId: savedEntryId, date: savedDate });
		if (!isMounted) return;
		navigation.showTimeEntryDay(savedDate);
		onLeave?.();
	}

	function handleDiscard() {
		return resolveCapture(discardCapture);
	}

	async function discardCapture() {
		if (entryId) {
			try {
				await dataService.discardTimer(entryId, { expectedStartedAt: expectedStartedAt() });
			} catch (caughtError) {
				const conflict = timerConflictFrom(caughtError);
				if (conflict) {
					await reloadFromServer(describeTimerConflict(conflict, 'discard'));
					announceChange();
					return;
				}
				// Otherwise best effort, as before: a draft left on the server comes back on the next load
			}
		}
		resetTimer();
		announceChange();
		if (isMounted) onLeave?.();
	}

	/**
	 * Forget this widget's copy and read the capture again (server draft, else pending timer). The
	 * capture store keeps the typed fields for the same capture; a changed interval resets only the
	 * time text (sprint 053-DR). `message` explains why, after a refused save or discard.
	 */
	async function reloadFromServer(message = '') {
		if (descriptionDebounceTimer) clearTimeout(descriptionDebounceTimer);
		const previous = {
			timerState,
			entryId,
			startTime,
			timerDate,
			endTime,
			elapsedSeconds,
			draftContractId,
			draftDescription
		};
		isLoading = true;
		timerState = 'idle';
		entryId = '';
		startTime = '';
		timerDate = '';
		endTime = '';
		elapsedSeconds = 0;
		draftContractId = '';
		draftDescription = '';
		isChangingContract = false;
		errorMessage = '';
		const reloaded = await checkExistingTimer(true);
		if (!reloaded) {
			// No connection: keep what this widget showed (a stopped capture stays stopped) and say so
			({ timerState, entryId, startTime, timerDate, endTime, elapsedSeconds, draftContractId, draftDescription } = previous);
			if (timerState === 'stopped') openCompletion();
			errorMessage = message
				? 'This timer changed or was resolved on another device, and it could not be reloaded. Check your connection, then try again.'
				: 'The timer could not be reloaded. Check your connection.';
			return;
		}
		errorMessage = message;
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
		isChangingContract = false;
		clearPendingTimer();
		captureDraft.clear();
		sharedTimerState.reset();
		if (descriptionDebounceTimer) {
			clearTimeout(descriptionDebounceTimer);
		}
	}

	function handleAddEntryCreated(created: { entryId: string; date: string }) {
		showAddEntryModal = false;
		dispatchTimeEntrySaved(created);
		navigation.showTimeEntryDay(created.date);
	}
</script>

<div
	class="relative {isScreen
		? 'flex min-h-0 flex-1 flex-col bg-surface'
		: placement === 'footer'
			? 'border-t border-divider bg-surface px-4 py-3'
			: 'rounded-lg border border-divider bg-surface p-3 shadow-sm'} {isCompact ? '!py-2' : ''}"
	data-testid="timer-widget-{placement}"
	data-compact={isCompact ? 'true' : undefined}
>
	{#if isLoading}
		<div class="py-2 text-center text-sm text-ink-faint">Loading timer...</div>
	{:else if timerState === 'idle'}
		<div class="flex gap-2 {isScreen ? 'px-4 pt-3' : ''}">
			<button
				onclick={handleStart}
				class="flex-1 rounded-md bg-leaf-600 px-2 py-2.5 text-sm font-medium whitespace-nowrap text-on-accent hover:bg-leaf-700"
			>
				Start Timer
			</button>
			<button
				onclick={() => (showAddEntryModal = true)}
				class="flex-1 rounded-md btn-secondary px-2 py-2.5 text-sm font-medium whitespace-nowrap"
			>
				Add Entry
			</button>
		</div>
	{:else}
		<TimerIdentityHeader
			status={timerState}
			contractName={identityContract?.name ?? ''}
			clientName={identityContract?.clientName ?? ''}
			clientColorIndex={identityContract?.clientColorIndex ?? 0}
			{elapsedSeconds}
			compact={isCompact}
			{canCollapse}
			onToggleCompact={toggleCompact}
			onChangeContract={timerState === 'running' ? startChangingContract : undefined}
			{isChangingContract}
			bleedClass={isScreen ? 'mx-4 mt-3 rounded-panel shrink-0' : placement === 'footer' ? '-mx-4 -mt-3' : '-mx-3 -mt-3 rounded-t-[7px]'}
		/>
		{#if isScreen && errorMessage}
			<div class="mx-4 mb-2 rounded-control bg-rust-50 p-2 text-xs text-rust-600" role="alert" data-testid="timer-error">
				{errorMessage}
			</div>
		{/if}
		<!-- Collapsed: the body stays mounted and is only hidden, so nothing typed is lost -->
		<div hidden={isCompact} class={isScreen ? 'flex min-h-0 flex-1 flex-col' : ''} data-testid="timer-widget-body">
			{#if timerState === 'running'}
				<TimerRunningPanel
					{elapsedSeconds}
					{startTime}
					startDate={timerDate}
					onChangeStart={handleChangeStart}
					onStop={handleStop}
					bind:draftContractId
					bind:draftDescription
					bind:isChangingContract
					onDescriptionInput={handleDescriptionInput}
					onAttachNote={attachNoteToRunningTimer}
					onSplit={splitHandler}
					layout={isScreen ? 'screen' : 'panel'}
				/>
			{:else if timerState === 'stopped'}
				<TimerCompletionForm
					onSave={handleSave}
					onDiscard={handleDiscard}
					frozenMinutes={Math.max(1, Math.ceil(elapsedSeconds / 60))}
					{startTime}
					{endTime}
					onSplit={splitHandler}
					layout={isScreen ? 'screen' : 'panel'}
				/>
			{/if}
		</div>
	{/if}

	{#if errorMessage && !(isScreen && timerState !== 'idle')}
		<div class="mt-2 rounded-md bg-rust-50 p-2 text-xs text-rust-600 {isScreen ? 'mx-4' : ''}" role="alert" data-testid="timer-error">
			{errorMessage}
		</div>
	{/if}
</div>

{#if showAddEntryModal}
	<AddTimeEntryModal
		initialDate={modalDate}
		initialContractId={modalContractId}
		onCreated={handleAddEntryCreated}
		onClose={() => (showAddEntryModal = false)}
	/>
{/if}
