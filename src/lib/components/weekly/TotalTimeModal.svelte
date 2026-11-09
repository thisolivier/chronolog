<!--
	TotalTimeModal (sprint 065-TT): opened from the week total. A date range (From / To, plus quick
	choices: All time, the viewed week, This week, This month, This year), then the total recorded
	(directly under the range, so it is in view on open on a phone), then the contracts to include
	(every contract checked at first, inactive, archived and the system Deleted Contract included, so
	the total matches the week total it was opened from; always sent as IDs; All / None), the total updating as the choices
	change (requests debounced 200 ms, stale replies ignored). Online only: offline it says
	"Needs a connection". Desktop: a centred overlay. Phone: full window, the header as a top bar
	(title left, Close right) and the fields scrolling under it, sized to the visual viewport like
	AddTimeEntryModal. Escape, a backdrop click and Close all close; focus goes back to the opener.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getDataService } from '$lib/services/context';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { getSundayOfWeek } from '$lib/utils/iso-week';
	import { localDateString } from '$lib/components/timer/local-date';
	import { VisualViewportBox } from '$lib/components/timer/visual-viewport.svelte';
	import type { TotalTimeResult as TotalTimeReply } from '$lib/services/types';
	import TotalTimeContractList from './TotalTimeContractList.svelte';
	import TotalTimeResult from './TotalTimeResult.svelte';
	import {
	contractsForRequest,
	describeRange,
	isConnectionFailure,
	matchingPresetKey,
	rangePresets,
	totalDisplay,
	type PickerContract,
	type TotalDisplay
} from './total-time';

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
	const presets = rangePresets(localDateString(), viewedWeekStart);

	let fromDate = $state(viewedWeekStart);
	let toDate = $state(getSundayOfWeek(viewedWeekStart));
	let contracts = $state<PickerContract[]>([]);
	let contractsLoaded = $state(false);
	let contractsFailure = $state<'offline' | 'error' | null>(null);
	const selectedContractIds = new SvelteSet<string>();

	let reply = $state<TotalTimeReply | null>(null);
	let isLoading = $state(false);
	let failure = $state<'offline' | 'error' | null>(null);
	let requestSequence = 0;

	const range = $derived({ from: fromDate, to: toDate });
	const selectedPresetKey = $derived(matchingPresetKey(range, presets));
	// Until the contract list is in, the result waits (or reports why the list failed)
	const display: TotalDisplay = $derived(
		contractsLoaded
			? totalDisplay({ selectedCount: selectedContractIds.size, range, isLoading, failure, result: reply })
			: { kind: contractsFailure ?? 'loading' }
	);

	let closeButton: HTMLButtonElement | undefined = $state();

	const viewportBox = new VisualViewportBox();
	$effect(() => viewportBox.track());

	onMount(() => {
		closeButton?.focus();
		// Archived and the system Deleted Contract included; every one ticked to match the week total
		dataService
			.getContractsByClient({ includeSystem: true })
			.then((contractList) => {
				contracts = contractList;
				for (const contract of contractList) selectedContractIds.add(contract.id);
				contractsLoaded = true;
			})
			.catch((error) => {
				contractsFailure = isConnectionFailure(error, connectivity.isOffline) ? 'offline' : 'error';
			});
		const focusOnClose = returnFocusTo;
		return () => {
			if (focusOnClose?.isConnected) focusOnClose.focus();
		};
	});

	// Ask for the total 200 ms after the last change; only the newest request's reply is shown
	$effect(() => {
		const listedContractIds = contracts.map((contract) => contract.id);
		const request = { from: fromDate || null, to: toDate || null, contracts: contractsForRequest(listedContractIds, selectedContractIds) };
		const isAskable = contractsLoaded && selectedContractIds.size > 0 && !(request.from && request.to && request.from > request.to);
		const sequence = ++requestSequence;
		untrack(() => {
			isLoading = isAskable;
			failure = null;
			reply = null;
		});
		if (!isAskable) return;
		const debounceTimer = setTimeout(async () => {
			try {
				const totalReply = await dataService.getTotalTime(request);
				if (sequence === requestSequence) reply = totalReply;
			} catch (error) {
				if (sequence === requestSequence) failure = isConnectionFailure(error, connectivity.isOffline) ? 'offline' : 'error';
			} finally {
				if (sequence === requestSequence) isLoading = false;
			}
		}, 200);
		return () => clearTimeout(debounceTimer);
	});

	function toggleContract(contractId: string) {
		if (selectedContractIds.has(contractId)) selectedContractIds.delete(contractId);
		else selectedContractIds.add(contractId);
	}

	function selectAllContracts() {
		for (const contract of contracts) selectedContractIds.add(contract.id);
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) onClose();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		event.preventDefault();
		onClose();
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div
	class="fixed inset-x-0 z-50 flex justify-center bg-chalk-950/40 md:items-center md:p-4"
	style={viewportBox.style}
	onclick={handleBackdropClick}
	role="presentation"
	data-testid="total-time-backdrop"
>
	<div
		class="flex h-full w-full flex-col bg-surface shadow-xl md:h-auto md:max-h-full md:max-w-lg md:overflow-hidden md:rounded-panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="total-time-title"
		data-testid="total-time-modal"
	>
		<header class="flex shrink-0 items-center gap-3 bg-bark-600 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-on-accent md:px-6 md:pt-2">
			<h2 id="total-time-title" class="text-base font-semibold">Total time</h2>
			<button
				type="button"
				bind:this={closeButton}
				onclick={onClose}
				class="ml-auto rounded-control px-2 py-1 text-sm text-bark-50 hover:bg-bark-500 focus-visible:ring-2 focus-visible:ring-ochre-300 focus-visible:outline-none pointer-coarse:min-h-11"
				data-testid="total-time-close"
			>Close</button>
		</header>

		<div class="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
			<div>
				<div class="grid grid-cols-2 gap-3">
					<label class="block text-xs font-medium text-ink-muted">From
						<input type="date" bind:value={fromDate} max={toDate || undefined} class="mt-0.5 block w-full rounded-control input-base px-2 py-1.5 text-sm" data-testid="total-time-from" />
					</label>
					<label class="block text-xs font-medium text-ink-muted">To
						<input type="date" bind:value={toDate} min={fromDate || undefined} class="mt-0.5 block w-full rounded-control input-base px-2 py-1.5 text-sm" data-testid="total-time-to" />
					</label>
				</div>
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each presets as preset (preset.key)}
						{@const isSelected = selectedPresetKey === preset.key}
						<button
							type="button"
							onclick={() => ((fromDate = preset.range.from), (toDate = preset.range.to))}
							aria-pressed={isSelected}
							class={[
								'rounded-control border px-2.5 py-0.5 text-xs pointer-coarse:min-h-11',
								isSelected ? 'border-bark-600 bg-bark-600 text-on-accent' : 'border-line btn-quiet'
							]}
							data-testid="total-time-preset-{preset.key}"
						>{preset.label}</button>
					{/each}
				</div>
			</div>

			<TotalTimeResult {display} rangeLabel={describeRange(range)} />

			{#if contractsLoaded}
				<TotalTimeContractList
					{contracts}
					isSelected={(contractId) => selectedContractIds.has(contractId)}
					onToggle={toggleContract}
					onSelectAll={selectAllContracts}
					onSelectNone={() => selectedContractIds.clear()}
				/>
			{/if}
		</div>
	</div>
</div>
