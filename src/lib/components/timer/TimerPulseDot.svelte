<!--
	The running-capture light (design r1 TC-02): a green dot that pulses while a timer runs.
	Under prefers-reduced-motion app.css stops every animation, so it is a static dot. It means
	"running" only: a stopped, unfinished capture never shows it.
-->
<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<span class="timer-pulse-dot {className}" aria-hidden="true" data-testid="timer-running-dot"></span>

<style>
	.timer-pulse-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--color-running);
		animation: timer-pulse 2s ease-in-out infinite;
	}

	@keyframes timer-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.8);
		}
	}
</style>
