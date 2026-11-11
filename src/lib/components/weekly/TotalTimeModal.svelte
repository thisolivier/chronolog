<!--
	TotalTimeModal (sprint 065-TT; approved r1 layout, sprint 066-TR, docs/design/total-time-r1):
	opened from the week total. State and data are unchanged from 065-TT: the viewed week's range,
	every contract ticked at first (inactive, archived and the system Deleted Contract included, so
	the total matches the week total; always sent as IDs), the total re-asked 200 ms after the last
	change with stale replies ignored, online only ("Needs a connection", with Try again).
	Desktop (`md` and up, as AddTimeEntryModal): a centred bounded modal, the bark header, the date
	toolbar, then two columns: the result left, the Contracts column right, each scrolling inside.
	Phone: full window sized to the visual viewport; presets, dates, a "Contracts · N selected" row
	that opens TotalTimeContractSheet, then the result; the page scrolls. One selection, shown in
	whichever place the width allows, so a resize keeps it and never doubles an overlay. Escape
	closes the sheet first, then the modal; a backdrop click and Close close; focus returns to the
	opener. While open the page is scroll-locked (`lockBodyScroll`, for iOS) and only the inner
	scrollers take touch panning (`touch-action: none` on the overlay, `pan-y` on the scrollers).
-->
<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import { getDataService } from '$lib/services/context';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { getSundayOfWeek } from '$lib/utils/iso-week';
	import { localDateString } from '$lib/components/timer/local-date';
	import { VisualViewportBox } from '$lib/components/timer/visual-viewport.svelte';
	import { lockBodyScroll } from '$lib/utils/scroll-lock';
	import TotalTimeContractList from './TotalTimeContractList.svelte';
	import TotalTimeContractsPanel from './TotalTimeContractsPanel.svelte';
	import TotalTimeContractSheet from './TotalTimeContractSheet.svelte';
	import TotalTimeContractsRow from './TotalTimeContractsRow.svelte';
	import TotalTimeDateToolbar from './TotalTimeDateToolbar.svelte';
	import TotalTimeResult from './TotalTimeResult.svelte';
	import * as totalTime from './total-time';
	import { TotalTimeQuery } from './total-time-query.svelte';

	let {
		weekStart,
		returnFocusTo = null,
		onClose
	}: {
		weekStart: string;
		/** Focused again on close (WebKit never focuses a clicked button, so it is passed in) */
		returnFocusTo?: HTMLElement | null;
		onClose: () => void;
	} = $props();

	const dataService = getDataService();
	const viewedWeekStart = untrack(() => weekStart);
	const presets = totalTime.rangePresets(localDateString(), viewedWeekStart);
	/** The app's phone / desktop line (Tailwind `md`, 48rem) */
	const wideLayout = new MediaQuery('(min-width: 48rem)');

	let fromDate = $state(viewedWeekStart);
	let toDate = $state(getSundayOfWeek(viewedWeekStart));
	let contracts = $state<totalTime.PickerContract[]>([]);
	let contractsLoaded = $state(false);
	let contractsFailure = $state<'offline' | 'error' | null>(null);
	const selectedContractIds = new SvelteSet<string>();

	const classifyFailure = (error: unknown) => (totalTime.isConnectionFailure(error, connectivity.isOffline) ? 'offline' : 'error');
	const totalQuery = new TotalTimeQuery((request) => dataService.getTotalTime(request), classifyFailure);

	let isSheetOpen = $state(false);
	let isBreakdownOpen = $state(true);
	let isHiddenOpen = $state(false);

	const range = $derived({ from: fromDate, to: toDate });
	const isBackwards = $derived(totalTime.isRangeBackwards(range));
	const selectedPresetKey = $derived(totalTime.matchingPresetKey(range, presets));
	const colorIndexes = $derived(totalTime.colorIndexByContract(contracts));
	// Until the contract list is in, the result waits (or reports why the list failed)
	const display: totalTime.TotalDisplay = $derived(
		contractsLoaded
			? totalTime.totalDisplay({
					selectedCount: selectedContractIds.size,
					range,
					isLoading: totalQuery.isLoading,
					failure: totalQuery.failure,
					result: totalQuery.reply
				})
			: { kind: contractsFailure ?? 'loading' }
	);
	const isSheetShown = $derived(isSheetOpen && !wideLayout.current);

	let closeButton: HTMLButtonElement | undefined = $state();
	let contractsRow: HTMLButtonElement | undefined = $state();

	const viewportBox = new VisualViewportBox();
	$effect(() => viewportBox.track());
	// iOS: pin the page so nothing behind scrolls or rubber-bands while the modal is open
	$effect(() => lockBodyScroll());
	// Wide again: the selection is in the column, so the sheet is simply gone (not reopened later)
	$effect(() => {
		if (wideLayout.current) untrack(() => (isSheetOpen = false));
	});

	function loadContracts() {
		contractsFailure = null;
		// Archived and the system Deleted Contract included; every one ticked to match the week total
		dataService
			.getContractsByClient({ includeSystem: true })
			.then((contractList) => {
				contracts = contractList;
				for (const contract of contractList) selectedContractIds.add(contract.id);
				contractsLoaded = true;
			})
			.catch((error) => {
				contractsFailure = classifyFailure(error);
			});
	}

	onMount(() => {
		closeButton?.focus();
		loadContracts();
		const focusOnClose = returnFocusTo;
		return () => {
			if (focusOnClose?.isConnected) focusOnClose.focus();
		};
	});

	// The total follows the range and selection (debounced, newest reply only; total-time-query)
	$effect(() =>
		totalQuery.follow(() => {
			if (!contractsLoaded || selectedContractIds.size === 0 || isBackwards) return null;
			const listedContractIds = contracts.map((contract) => contract.id);
			return { from: fromDate || null, to: toDate || null, contracts: totalTime.contractsForRequest(listedContractIds, selectedContractIds) };
		})
	);

	function retry() {
		if (contractsLoaded) totalQuery.retry();
		else loadContracts();
	}

	function toggleContract(contractId: string) {
		if (selectedContractIds.has(contractId)) selectedContractIds.delete(contractId);
		else selectedContractIds.add(contractId);
	}

	function selectAllContracts() {
		for (const contract of contracts) selectedContractIds.add(contract.id);
	}

	async function closeSheet() {
		isSheetOpen = false;
		await tick();
		contractsRow?.focus();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) onClose();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		event.preventDefault();
		if (isSheetShown) closeSheet();
		else onClose();
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#snippet contractList()}
	<TotalTimeContractList {contracts} isSelected={(contractId) => selectedContractIds.has(contractId)} onToggle={toggleContract} bind:isHiddenOpen />
{/snippet}

<div
	class="fixed inset-x-0 z-50 flex touch-none justify-center bg-chalk-950/40 md:items-center md:p-6"
	style={viewportBox.style}
	onclick={handleBackdropClick}
	role="presentation"
	data-testid="total-time-backdrop"
>
	<div
		class="relative flex h-full w-full flex-col overflow-hidden bg-surface shadow-xl md:max-h-[46rem] md:max-w-5xl md:rounded-panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="total-time-title"
		data-testid="total-time-modal"
	>
		<header class="flex shrink-0 items-center gap-3 bg-bark-600 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-on-accent md:px-6 md:py-2.5">
			<h2 id="total-time-title" class="text-lg font-semibold">Total time</h2>
			<button
				type="button"
				bind:this={closeButton}
				onclick={onClose}
				class="ml-auto rounded-control px-2 py-1 text-sm text-bark-50 hover:bg-bark-500 focus-visible:ring-2 focus-visible:ring-ochre-300 focus-visible:outline-none pointer-coarse:min-h-11"
				data-testid="total-time-close"
			>Close</button>
		</header>

		<div class="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:flex md:flex-col md:overflow-hidden md:px-6 md:pt-5 md:pb-0" data-testid="total-time-body">
			<TotalTimeDateToolbar {presets} {selectedPresetKey} {isBackwards} bind:fromDate bind:toDate />

			<div class="md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
				<div class="flex flex-col pt-1 md:min-h-0 md:touch-pan-y md:overflow-y-auto md:overscroll-contain md:pt-5 md:pr-6 md:pb-5" data-testid="total-time-result-column">
					{#if !wideLayout.current && contractsLoaded}
						<TotalTimeContractsRow bind:element={contractsRow} selectedCount={selectedContractIds.size} isExpanded={isSheetShown} onOpen={() => (isSheetOpen = true)} />
					{/if}
					<TotalTimeResult {display} colorIndexFor={(contractId) => colorIndexes.get(contractId) ?? 0} bind:isBreakdownOpen onRetry={retry} />
				</div>
				{#if wideLayout.current && contractsLoaded}
					<div class="flex min-h-0 flex-col border-l border-divider pt-5 pb-5 pl-6">
						<TotalTimeContractsPanel selectedCount={selectedContractIds.size} onSelectAll={selectAllContracts} onSelectNone={() => selectedContractIds.clear()}>
							{@render contractList()}
						</TotalTimeContractsPanel>
					</div>
				{/if}
			</div>
		</div>

		{#if isSheetShown}
			<TotalTimeContractSheet viewportStyle={viewportBox.style} selectedCount={selectedContractIds.size} onSelectAll={selectAllContracts} onSelectNone={() => selectedContractIds.clear()} onDone={closeSheet}>
				{@render contractList()}
			</TotalTimeContractSheet>
		{/if}
	</div>
</div>
