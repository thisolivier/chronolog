<script lang="ts">
	import { getClientBorderClass } from '$lib/utils/client-colors';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { isSidebarTimerWidgetMounted } from '$lib/components/timer/timer-widget-registry.svelte';
	import { formatElapsedClock } from '$lib/components/timer/timer-api';

	interface Props {
		timerState: 'idle' | 'running' | 'paused' | 'stopped';
		elapsedSeconds: number;
		description: string;
		contractName: string;
		clientColorIndex: number;
		onIndicatorClick: () => void;
	}

	let { timerState, elapsedSeconds, description, contractName, clientColorIndex, onIndicatorClick }: Props = $props();

	let formattedTime = $derived(formatElapsedClock(elapsedSeconds));
	// No contract yet: a neutral edge, not the colour of whichever client sits in slot 0
	let borderClass = $derived(contractName ? getClientBorderClass(clientColorIndex) : 'border-l-line');
	let truncatedDescription = $derived(
		description.length > 30 ? description.slice(0, 30) + '…' : description
	);
	let isVisible = $derived(timerState === 'running' || timerState === 'paused');

	// With the desktop sidebar collapsed its TimerWidget is out of sight: keep a way to reach it
	const navigationContext = getNavigationContext();
	let isSidebarTimerHidden = $derived(
		navigationContext.panel1Collapsed && isSidebarTimerWidgetMounted()
	);
</script>

{#if isVisible}
	<button
		data-testid="timer-indicator"
		class="flex items-center gap-2 rounded bg-chalk-100 px-3 py-1.5 border-l-2 cursor-pointer hover:bg-chalk-200 transition-colors {borderClass}"
		onclick={onIndicatorClick}
	>
		{#if timerState === 'running'}
			<span class="timer-dot-running"></span>
		{:else}
			<span class="timer-dot-paused"></span>
		{/if}

		<span class="text-sm font-medium text-ink-soft tabular-nums">{formattedTime}</span>

		{#if timerState === 'paused'}
			<span class="text-xs text-ink-faint">(paused)</span>
		{/if}

		<span class="hidden max-w-[200px] truncate text-sm text-ink-faint sm:inline">{truncatedDescription}</span>

		{#if timerState === 'running' && contractName}
			<span class="hidden text-sm text-ink-faint md:inline">·</span>
			<span class="hidden text-sm text-ink-faint md:inline">{contractName}</span>
		{/if}
	</button>
{:else if isSidebarTimerHidden}
	<button
		class="flex items-center gap-2 rounded border-l-2 border-l-line bg-chalk-100 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-chalk-200"
		onclick={onIndicatorClick}
		title="Open the sidebar timer"
		data-testid="timer-indicator-collapsed"
	>
		{#if timerState === 'stopped'}
			<span class="timer-dot-paused"></span>
			Timer stopped: save entry
		{:else}
			<span aria-hidden="true">&#9654;</span>
			Timer
		{/if}
	</button>
{/if}

<style>
	.timer-dot-running {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--color-running);
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.8); }
	}

	.timer-dot-paused {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1.5px solid var(--color-chalk-400);
		background: transparent;
	}
</style>
