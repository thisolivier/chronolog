<!--
	SplitTimeButton — the Split time entry point (design r1 TC-07 / SP-01, sprint 055-DR): beside
	Add note on the running desktop timer and in the stopped form's header. Never on a phone
	layout (no small-layout split). Disabled offline: timer requests are not queued.
	STAGE 5 STUB: the split overlay does not exist yet, so `onSplit` is absent and the button is
	disabled with "Split time (coming soon)". Stage 5 passes the handler (split-entry.ts).
-->
<script lang="ts">
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';

	let { onSplit = undefined }: { onSplit?: () => void } = $props();

	const navigation = getNavigationContext();
	const isOffline = $derived(connectivity.isOffline);
	const isDisabled = $derived(isOffline || !onSplit);
	const tooltip = $derived(
		isOffline ? 'Split time is not available offline' : onSplit ? 'Split time' : 'Split time (coming soon)'
	);
</script>

{#if navigation.layoutMode !== 'mobile'}
	<button
		type="button"
		onclick={() => onSplit?.()}
		disabled={isDisabled}
		aria-label="Split time"
		title={tooltip}
		data-testid="timer-split-button"
		class="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-pine-50 hover:text-pine-600 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
	>
		<!-- Two blocks either side of a cut -->
		<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
			<rect x="1.75" y="4.25" width="4.5" height="7.5" rx="1" />
			<rect x="9.75" y="4.25" width="4.5" height="7.5" rx="1" />
			<path d="M8 2v12" stroke-dasharray="1.5 1.5" stroke-linecap="round" />
		</svg>
	</button>
{/if}
