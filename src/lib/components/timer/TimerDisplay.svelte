<script lang="ts">
	import { formatElapsedClock } from './timer-api';

	let {
		elapsedSeconds,
		isPaused = false,
		size = 'regular'
	}: { elapsedSeconds: number; isPaused?: boolean; size?: 'regular' | 'large' } = $props();

	let formattedTime = $derived(formatElapsedClock(elapsedSeconds));
</script>

<span
	class="font-mono font-bold tabular-nums {size === 'large' ? 'text-4xl' : 'text-2xl'}"
	class:text-ink-faint={isPaused}
	data-testid="timer-elapsed"
>
	{formattedTime}
	{#if isPaused}
		<span class="text-sm font-normal text-ink-faint">(paused)</span>
	{/if}
</span>
