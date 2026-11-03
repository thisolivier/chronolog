<script lang="ts">
	import { formatElapsedClock } from './timer-api';

	let { elapsedSeconds, isPaused = false }: { elapsedSeconds: number; isPaused?: boolean } =
		$props();

	let formattedTime = $derived(formatElapsedClock(elapsedSeconds));
</script>

<span class="font-mono text-2xl font-bold tabular-nums" class:text-stone-400={isPaused}>
	{formattedTime}
	{#if isPaused}
		<span class="text-sm font-normal text-stone-400">(paused)</span>
	{/if}
</span>
