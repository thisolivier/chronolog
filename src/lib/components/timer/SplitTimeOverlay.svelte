<!--
	SplitTimeOverlay — the desktop two-card split (design r1 SP-01..SP-07, sprint 056-DR UI). Two
	independent cards float over the dimmed app with a modest "Split time" label, a floating Cancel
	and Flip between the cards; no enclosing dialog, no shared footer, no chevrons. Moved to <body>
	and everything else made inert while open, so the sidebar timer and the header pill cannot be
	used (one visible capture, SH-04). The state is `splitSession` (split-session.svelte.ts).

	The right card's testid starts with "timer-widget-" on purpose: the Tauri tray presses the first
	"Stop" inside such an element, and while the split is open the sidebar widget shows no Stop, so
	the tray's Stop is the right card's (freeze the live end). Closed, the overlay is unmounted.
-->
<script lang="ts">
	import WikiLinkRenderer from '$lib/components/weekly/WikiLinkRenderer.svelte';
	import { untrack } from 'svelte';
	import { getDataService } from '$lib/services/context';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { formatMinutes } from '$lib/utils/duration';
	import type { ContractOption } from '$lib/services/types';
	import { formatContractLabel } from './contract-label';
	import type { OntologyCascade } from './ontology-cascade.svelte';
	import SplitContentFields from './SplitContentFields.svelte';
	import SplitTimesFields from './SplitTimesFields.svelte';
	import { splitSession } from './split-session.svelte';
	import {
		applyDurationText,
		atClockNear,
		clockOf,
		partMinutes,
		splitTimesProblems,
		withBoundary,
		withEnd,
		withStart,
		type SplitPartName
	} from './split-times';

	const navigation = getNavigationContext();
	const dataService = getDataService();

	let now = $state(Date.now());
	$effect(() => {
		const intervalId = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(intervalId);
	});

	let contracts: ContractOption[] = $state([]);
	$effect(() => {
		dataService.getContracts().then((list) => (contracts = list)).catch(() => undefined);
	});
	function contractLabel(contractId: string): string {
		const contract = contracts.find((candidate) => candidate.id === contractId);
		return contract ? formatContractLabel(contract.clientName, contract.name) : '';
	}

	// SP-07: the small layout cancels the split UI (or returns the remainder); never stacked cards
	$effect(() => {
		if (navigation.layoutMode === 'mobile') untrack(() => splitSession.collapseForSmallLayout());
	});
	$effect(() => () => {
		if (splitSession.isOpen) splitSession.collapseForSmallLayout();
	});

	const times = $derived(splitSession.times);
	const phase = $derived(splitSession.phase);
	const actions = $derived(splitSession.actions);
	const leftResolved = $derived(splitSession.leftResult !== null);
	const problems = $derived(splitTimesProblems(times, now));
	const leftMinutes = $derived(partMinutes(times.start, times.boundary));
	const rightMinutes = $derived(partMinutes(times.boundary, times.end ?? now));
	const isBusy = $derived(phase === 'left-saving' || phase === 'right-busy');

	let leftCascade: OntologyCascade | undefined = $state();
	let rightCascade: OntologyCascade | undefined = $state();

	// The resolved summary keeps the left card's footprint, so the right card does not jump
	let leftCardHeight = $state(0);
	let lockedLeftHeight = $state(0);
	$effect(() => {
		if (!leftResolved) lockedLeftHeight = leftCardHeight;
	});

	function confirmDuration(part: SplitPartName, text: string): string {
		const applied = applyDurationText(splitSession.times, part, text, Date.now());
		if (!applied.ok) return applied.error;
		splitSession.setTimes(applied.times);
		return '';
	}
	const setStart = (clock: string) => {
		const start = atClockNear(splitSession.times.start, clock);
		if (start !== null) splitSession.setTimes(withStart(splitSession.times, start));
	};
	const setBoundary = (clock: string) => {
		const boundary = atClockNear(splitSession.times.boundary, clock);
		if (boundary !== null) splitSession.setTimes(withBoundary(splitSession.times, boundary));
	};
	const setEnd = (clock: string) => {
		const current = splitSession.times.end;
		const end = current === null ? null : atClockNear(current, clock);
		if (end !== null) splitSession.setTimes(withEnd(splitSession.times, end));
	};

	async function resolveLeft(action: 'save' | 'discard') {
		if (action === 'save') await leftCascade?.settled();
		await splitSession.resolveLeft(action);
	}
	let rightBusyAction = $state('');
	async function runRightAction(label: string, run: () => Promise<unknown>) {
		rightBusyAction = label;
		try {
			await run();
		} finally {
			rightBusyAction = '';
		}
	}
	async function saveRight() {
		await rightCascade?.settled();
		const savedDate = await splitSession.saveRight();
		if (savedDate) navigation.showTimeEntryDay(savedDate);
	}
	async function resumeRight() {
		await rightCascade?.settled();
		await splitSession.resumeRight();
	}
	const rightActions = [
		{ label: 'Discard', busyLabel: 'Discarding…', run: () => splitSession.discardRight(), style: 'btn-secondary' },
		{ label: 'Save', busyLabel: 'Saving…', run: saveRight, style: 'btn-primary font-medium' },
		{ label: 'Resume', busyLabel: 'Resuming…', run: resumeRight, style: 'btn-secondary' }
	];

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		// A focused select may have its list open: Escape belongs to it
		if (event.target instanceof HTMLSelectElement) return;
		event.preventDefault();
		splitSession.dismiss();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) splitSession.dismiss();
	}

	/** Move the overlay to <body> and make the rest of the page inert while it is open */
	function overlayPortal(node: HTMLElement) {
		document.body.appendChild(node);
		const madeInert: Element[] = [];
		for (const sibling of Array.from(document.body.children)) {
			if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT') continue;
			sibling.setAttribute('inert', '');
			madeInert.push(sibling);
		}
		node.focus();
		return {
			destroy() {
				for (const element of madeInert) element.removeAttribute('inert');
				node.remove();
			}
		};
	}

	const cardClass = 'flex w-[min(23rem,calc(50vw-3.5rem))] flex-col rounded-panel bg-surface p-5 shadow-menu';
	const titleClass = 'text-sm font-semibold text-ink';
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	use:overlayPortal
	class="fixed inset-0 z-[60] flex justify-center overflow-y-auto bg-chalk-950/55 px-6 py-8"
	role="dialog"
	aria-modal="true"
	aria-labelledby="split-time-title"
	tabindex="-1"
	onclick={handleBackdropClick}
	data-testid="split-overlay"
	data-phase={phase}
>
	<div class="my-auto flex flex-col gap-3">
		<!-- The label and Cancel float above the cards, not in an enclosing card -->
		<div class="flex h-10 items-center justify-between">
			<h2 id="split-time-title" class="text-xl font-semibold text-on-accent">Split time</h2>
			{#if actions.flipAndCancel}
				<button
					type="button"
					onclick={() => splitSession.cancel('user')}
					class="rounded-control border border-on-accent/80 px-4 py-1.5 text-sm font-medium text-on-accent hover:bg-on-accent/10 focus-visible:ring-2 focus-visible:ring-on-accent focus-visible:outline-none"
					data-testid="split-cancel"
				>
					Cancel
				</button>
			{/if}
		</div>

		<div class="flex items-start gap-4">
			<!-- First part -->
			<section
				class={cardClass}
				style={leftResolved && lockedLeftHeight ? `min-height: ${lockedLeftHeight}px` : undefined}
				bind:clientHeight={leftCardHeight}
				aria-label="First part"
				data-testid="split-card-left"
			>
				<h3 class={titleClass}>First part</h3>
				{#if splitSession.leftResult}
					{@const result = splitSession.leftResult}
					<div class="mt-3 flex flex-1 flex-col gap-2" data-testid="split-left-summary">
						<p class="flex items-center gap-1.5 text-sm font-semibold {result.action === 'saved' ? 'text-success' : 'text-ink-muted'}">
							<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
								{#if result.action === 'saved'}<path d="m3.5 8.5 3 3 6-7" stroke-linecap="round" stroke-linejoin="round" />{:else}<path d="m4 4 8 8M12 4l-8 8" stroke-linecap="round" />{/if}
							</svg>
							{result.action === 'saved' ? 'Saved' : 'Discarded'}
						</p>
						<p class="text-3xl font-bold text-ink-soft tabular-nums">{formatMinutes(result.minutes)}</p>
						<p class="text-sm text-ink-muted tabular-nums" data-testid="split-left-summary-range">{clockOf(result.start)}–{clockOf(result.end)}</p>
						{#if result.action === 'saved'}
							{#if contractLabel(result.contractId)}<p class="text-sm font-medium text-ink">{contractLabel(result.contractId)}</p>{/if}
							{#if result.description}<p class="line-clamp-3 text-sm whitespace-pre-line text-ink-soft"><WikiLinkRenderer text={result.description} /></p>{/if}
						{:else}
							<p class="text-sm text-ink-muted">Left unlogged.</p>
						{/if}
					</div>
				{:else}
					<div class="mt-3 space-y-3">
						<SplitTimesFields
							idPrefix="split-left"
							minutes={leftMinutes}
							from={times.start}
							to={times.boundary}
							problem={problems.left}
							disabled={isBusy}
							onConfirmDuration={(text) => confirmDuration('left', text)}
							onFrom={setStart}
							onTo={setBoundary}
						/>
						{#key splitSession.contentVersion}
							<SplitContentFields
								selection={() => splitSession.left}
								idPrefix="split-left"
								contractError={splitSession.leftError === 'Pick a contract' ? 'Pick a contract' : ''}
								disabled={isBusy}
								bind:cascade={leftCascade}
							/>
						{/key}
						{#if splitSession.leftError && splitSession.leftError !== 'Pick a contract'}
							<p class="rounded-control bg-rust-50 p-2 text-xs text-rust-600" role="alert" data-testid="split-left-error">{splitSession.leftError}</p>
						{/if}
					</div>
					<div class="mt-4 flex justify-between gap-2 border-t border-divider pt-4">
						<button
							type="button"
							onclick={() => resolveLeft('discard')}
							disabled={!actions.leftResolve}
							class="rounded-control btn-secondary px-5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
						>
							Discard
						</button>
						<button
							type="button"
							onclick={() => resolveLeft('save')}
							disabled={!actions.leftResolve}
							class="rounded-control btn-primary px-6 py-1.5 text-sm font-medium disabled:cursor-wait disabled:opacity-70"
						>
							{phase === 'left-saving' ? 'Saving…' : splitSession.leftError && splitSession.leftError !== 'Pick a contract' ? 'Retry' : 'Save'}
						</button>
					</div>
				{/if}
			</section>

			<!-- Flip, between the cards (gone once the first part is resolved) -->
			<div class="flex w-14 shrink-0 flex-col items-center gap-1 self-center">
				{#if actions.flipAndCancel}
					<button
						type="button"
						onclick={() => splitSession.flip()}
						class="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-pine-700 shadow-menu hover:bg-pine-50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
						aria-labelledby="split-flip-label"
						data-testid="split-flip"
					>
						<svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
							<path d="M4 7h11m0 0-3-3m3 3-3 3M16 13H5m0 0 3-3m-3 3 3 3" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
					<span id="split-flip-label" class="text-xs font-medium text-on-accent">Flip</span>
				{/if}
			</div>

			<!-- Second part -->
			<section class={cardClass} aria-label="Second part" data-testid="timer-widget-split">
				<div class="flex min-h-8 items-center justify-between gap-2">
					<h3 class="{titleClass} flex items-center gap-2">
						Second part
						{#if splitSession.rightIsLive}<span class="h-2 w-2 rounded-full bg-running" aria-label="Running"></span>{/if}
					</h3>
					{#if actions.rightStop}
						<button
							type="button"
							onclick={() => splitSession.stopRight()}
							disabled={splitSession.isStopping}
							class="rounded-control btn-danger px-3 py-1 text-sm font-medium disabled:opacity-60"
						>
							Stop
						</button>
					{/if}
				</div>
				<div class="mt-3 space-y-3">
					<SplitTimesFields
						idPrefix="split-right"
						minutes={rightMinutes}
						from={times.boundary}
						to={times.end}
						suffix={times.end === null ? 'until now' : ''}
						problem={problems.right}
						disabled={isBusy}
						onConfirmDuration={(text) => confirmDuration('right', text)}
						onFrom={setBoundary}
						onTo={setEnd}
					/>
					{#key splitSession.contentVersion}
						<SplitContentFields
							selection={() => splitSession.right}
							idPrefix="split-right"
							contractError={splitSession.rightError === 'Pick a contract' ? 'Pick a contract' : ''}
							disabled={isBusy}
							bind:cascade={rightCascade}
						/>
					{/key}
					{#if splitSession.rightError && splitSession.rightError !== 'Pick a contract'}
						<p class="rounded-control bg-rust-50 p-2 text-xs text-rust-600" role="alert" data-testid="split-right-error">{splitSession.rightError}</p>
					{/if}
				</div>
				<div class="mt-4 border-t border-divider pt-3">
					{#if actions.rightResolveReason}
						<p id="split-right-reason" class="mb-2 text-xs text-ink-muted italic" data-testid="split-right-reason">{actions.rightResolveReason}</p>
					{/if}
					<div class="flex gap-2">
						{#each rightActions as rightAction (rightAction.label)}
							<button
								type="button"
								onclick={() => runRightAction(rightAction.label, rightAction.run)}
								disabled={!actions.rightResolve}
								aria-describedby={actions.rightResolveReason ? 'split-right-reason' : undefined}
								title={actions.rightResolveReason || undefined}
								class="flex flex-1 items-center justify-center gap-1 rounded-control {rightAction.style} px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if rightAction.label === 'Resume'}<svg class="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" /></svg>{/if}
								{rightBusyAction === rightAction.label ? rightAction.busyLabel : rightAction.label}
							</button>
						{/each}
					</div>
				</div>
			</section>
		</div>
	</div>
</div>
