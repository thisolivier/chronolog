<script lang="ts">
	let { elapsedSeconds, isPaused = false }: { elapsedSeconds: number; isPaused?: boolean } =
		$props();

	let formattedTime = $derived(formatElapsedTime(elapsedSeconds));

	function formatElapsedTime(totalSeconds: number): string {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return [
			String(hours).padStart(2, '0'),
			String(minutes).padStart(2, '0'),
			String(seconds).padStart(2, '0')
		].join(':');
	}
</script>

<span class="font-mono text-2xl font-bold tabular-nums" class:text-gray-400={isPaused}>
	{formattedTime}
	{#if isPaused}
		<span class="text-sm font-normal text-gray-400">(paused)</span>
	{/if}
</span>
