<script lang="ts">
	/**
	 * Offline banner (sprint 026-CL, finding 3). Says plainly what does and does not work offline;
	 * nothing is queued yet (that is the future outbox sprint), so it never claims changes are kept.
	 */
	import { onMount } from 'svelte';
	import { connectivity, trackBrowserConnectivity } from '$lib/stores/connectivity.svelte';
	import type { NavigationMode } from '$lib/stores/navigation.svelte';

	/** The main screen passes its mode so the message matches what is on screen. */
	let { mode = null }: { mode?: NavigationMode | null } = $props();

	// onMount, not $effect: the subscription reads connectivity state synchronously, so an effect
	// would re-run on every reportNetworkFailure() and reset it to "Back online" (QA 2, R1).
	onMount(trackBrowserConnectivity);

	const offlineMessage = $derived(
		mode === 'time-entries'
			? 'Offline, showing last loaded data. New and edited entries can’t be saved until you reconnect.'
			: mode === 'notes'
				? 'Offline, changes not saved. Note edits made now will not reach the server.'
				: 'Offline. Changes can’t be saved until you reconnect.'
	);
</script>

{#if connectivity.isOffline}
	<div
		class="flex flex-shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900"
		role="status"
		aria-live="polite"
		data-testid="connection-status-offline"
	>
		<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-amber-600" aria-hidden="true"></span>
		{offlineMessage}
	</div>
{:else if connectivity.recentlyReconnected}
	<div
		class="flex flex-shrink-0 items-center gap-2 border-b border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800"
		role="status"
		aria-live="polite"
		data-testid="connection-status-online"
	>
		<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-600" aria-hidden="true"></span>
		Back online. Reload anything that failed to save.
	</div>
{/if}
