<script lang="ts">
	import { formatElapsedClock } from './timer-api';

	let { elapsedSeconds, isPaused = false }: { elapsedSeconds: number; isPaused?: boolean } =
		$props();

	let formattedTime = $derived(formatElapsedClock(elapsedSeconds));
</script>

<span class="font-mono text-2xl font-bold tabular-nums" class:text-ink-faint={isPaused} data-testid="timer-elapsed">
	{formattedTime}
	{#if isPaused}
		<span class="text-sm font-normal text-ink-faint">(paused)</span>
	{/if}
</span>
