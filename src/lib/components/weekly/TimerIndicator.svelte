<!--
	TimerIndicator — the app bar's reflection of the capture (design r1 SH-04, sprint 053-DR).
	The shell decides whether it shows (`reflection`, from `timer-visibility.ts`): only while no
	TimerWidget is on screen. It names the capture's own contract (contract first, client under
	it, ContractMark), never the contract being browsed. Running: the clock and the pulsing dot at
	the top right. Stopped and unfinished: "Finish entry" with the frozen duration, no running
	light. Clicking it opens the same capture (the shell passes the action).
	`showIdleAccess` keeps the pre-053 "Timer" button when the desktop sidebar is hidden and no
	capture exists (the existing Start timer / Add entry access, SH-02 matrix last row).
-->
<script lang="ts">
	import { getTimerStateContext } from '$lib/stores/timer-state.svelte';
	import { calculateElapsedFromStartTime, formatElapsedClock } from '$lib/components/timer/timer-api';
	import { formatMinutes } from '$lib/utils/duration';
	import type { HeaderReflection } from '$lib/components/timer/timer-visibility';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import TimerPulseDot from '$lib/components/timer/TimerPulseDot.svelte';

	interface Props {
		reflection: HeaderReflection;
		showIdleAccess?: boolean;
		onIndicatorClick: () => void;
	}

	let { reflection, showIdleAccess = false, onIndicatorClick }: Props = $props();

	const timer = getTimerStateContext();

	// The widget may be unmounted (a phone note screen): tick from the capture's own start
	let now = $state(Date.now());
	$effect(() => {
		if (reflection !== 'running') return;
		const intervalId = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(intervalId);
	});

	const runningSeconds = $derived(
		timer.startTime ? calculateElapsedFromStartTime(timer.startTime, timer.startDate, new Date(now)) : timer.elapsedSeconds
	);
	const clockText = $derived(formatElapsedClock(runningSeconds));
	const frozenText = $derived(formatMinutes(Math.max(1, Math.ceil(timer.elapsedSeconds / 60))));
	const hasContract = $derived(Boolean(timer.contractTitle));
	const contractText = $derived(hasContract ? timer.contractTitle : 'No contract yet');
	const accessibleName = $derived(
		reflection === 'finish'
			? `Finish entry: ${contractText}, ${frozenText}`
			: `Timer running: ${contractText}, ${clockText}. Open the timer`
	);
</script>

{#if reflection !== 'none'}
	<button
		type="button"
		data-testid="timer-indicator"
		data-state={reflection}
		class="relative flex h-9 max-w-[22rem] min-w-0 items-center gap-mark-gap rounded-control border border-divider bg-sunken py-1 pr-4 pl-1.5 text-left transition-colors hover:bg-chalk-200"
		aria-label={accessibleName}
		title={reflection === 'finish' ? 'Finish this entry' : 'Open the running timer'}
		onclick={onIndicatorClick}
	>
		{#if hasContract}
			<ContractMark contractName={timer.contractTitle} colorIndex={timer.clientColorIndex} size="md" />
		{:else}
			<span class="size-(--size-mark-md) shrink-0 rounded-mark border border-dashed border-line" aria-hidden="true"></span>
		{/if}
		<span class="hidden min-w-0 flex-col leading-tight sm:flex" data-testid="timer-indicator-identity">
			<span class="truncate text-xs font-semibold text-ink">{contractText}</span>
			{#if timer.clientName}
				<span class="truncate text-[11px] text-ink-faint">{timer.clientName}</span>
			{/if}
		</span>
		{#if reflection === 'finish'}
			<span class="ml-1 flex flex-shrink-0 flex-col items-end leading-tight">
				<span class="text-xs font-semibold whitespace-nowrap text-warning">Finish entry</span>
				<span class="text-[11px] tabular-nums text-ink-muted" data-testid="timer-indicator-frozen">{frozenText}</span>
			</span>
		{:else}
			<span class="ml-1 flex-shrink-0 text-sm font-medium tabular-nums text-ink-soft" data-testid="timer-indicator-clock">{clockText}</span>
			<TimerPulseDot class="absolute top-1 right-1" />
		{/if}
	</button>
{:else if showIdleAccess}
	<button
		type="button"
		class="flex items-center gap-2 rounded-control border border-divider bg-sunken px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-chalk-200"
		onclick={onIndicatorClick}
		title="Open the sidebar timer"
		data-testid="timer-indicator-collapsed"
	>
		<span aria-hidden="true">&#9654;</span>
		Timer
	</button>
{/if}
