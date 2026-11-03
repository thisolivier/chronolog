<script lang="ts">
	import { getClientBorderClass } from '$lib/utils/client-colors';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { isSidebarTimerWidgetMounted } from '$lib/components/timer/timer-widget-registry.svelte';

	interface Props {
		timerState: 'idle' | 'running' | 'paused' | 'stopped';
		elapsedSeconds: number;
		description: string;
		contractName: string;
		clientColorIndex: number;
		onIndicatorClick: () => void;
	}

	let { timerState, elapsedSeconds, description, contractName, clientColorIndex, onIndicatorClick }: Props = $props();

	let formattedTime = $derived(formatElapsedTime(elapsedSeconds));
	let borderClass = $derived(getClientBorderClass(clientColorIndex));
	let truncatedDescription = $derived(
		description.length > 30 ? description.slice(0, 30) + '…' : description
	);
	let isVisible = $derived(timerState === 'running' || timerState === 'paused');

	// With the desktop sidebar collapsed its TimerWidget is out of sight: keep a way to reach it
	const navigationContext = getNavigationContext();
	let isSidebarTimerHidden = $derived(
		navigationContext.panel1Collapsed && isSidebarTimerWidgetMounted()
	);

	function formatElapsedTime(totalSeconds: number): string {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
</script>

{#if isVisible}
	<button
		class="flex items-center gap-2 rounded bg-stone-100 px-3 py-1.5 border-l-2 cursor-pointer hover:bg-stone-200 transition-colors {borderClass}"
		onclick={onIndicatorClick}
	>
		{#if timerState === 'running'}
			<span class="timer-dot-running"></span>
		{:else}
			<span class="timer-dot-paused"></span>
		{/if}

		<span class="text-sm font-medium text-stone-700 tabular-nums">{formattedTime}</span>

		{#if timerState === 'paused'}
			<span class="text-xs text-stone-400">(paused)</span>
		{/if}

		<span class="hidden max-w-[200px] truncate text-sm text-stone-500 sm:inline">{truncatedDescription}</span>

		{#if timerState === 'running' && contractName}
			<span class="hidden text-sm text-stone-400 md:inline">·</span>
			<span class="hidden text-sm text-stone-400 md:inline">{contractName}</span>
		{/if}
	</button>
{:else if isSidebarTimerHidden}
	<button
		class="flex items-center gap-2 rounded border-l-2 border-l-stone-300 bg-stone-100 px-3 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-200"
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
		background-color: #22c55e;
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
		border: 1.5px solid #a8a29e;
		background: transparent;
	}
</style>
