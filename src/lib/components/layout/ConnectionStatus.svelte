<script lang="ts">
	/**
	 * Offline banner (sprint 026-CL, finding 3; outbox in sprint 045-CL). Says what works offline:
	 * note and time entry changes are kept on this device and sent on reconnect. It shows how
	 * many wait, and while any change needs a decision it stays up (online too) with a Review
	 * button that opens the held panel.
	 */
	import { onMount } from 'svelte';
	import { connectivity, trackBrowserConnectivity } from '$lib/stores/connectivity.svelte';
	import type { NavigationMode } from '$lib/stores/navigation.svelte';
	import { outbox } from '$lib/offline/outbox-store.svelte';
	import OutboxHeldPanel from '$lib/offline/OutboxHeldPanel.svelte';

	/** The main screen passes its mode so the message matches what is on screen. */
	let { mode = null }: { mode?: NavigationMode | null } = $props();

	// onMount, not $effect: the subscription reads connectivity state synchronously, so an effect
	// would re-run on every reportNetworkFailure() and reset it to "Back online" (QA 2, R1).
	onMount(trackBrowserConnectivity);

	let isHeldPanelOpen = $state(false);

	const queuedCount = $derived(outbox.pendingCount);
	const heldCount = $derived(outbox.heldItems.length);

	const offlineMessage = $derived(
		mode === 'time-entries'
			? 'Offline, showing saved data. New and edited entries are kept on this device and sent when you reconnect.'
			: mode === 'notes'
				? 'Offline, showing saved data. Note edits are kept on this device and sent when you reconnect.'
				: 'Offline. Note and time entry changes are kept on this device and sent when you reconnect.'
	);

	function changes(count: number): string {
		return count === 1 ? '1 change' : `${count} changes`;
	}
</script>

{#snippet outboxSummary()}
	{#if outbox.otherAccountSignedIn}
		<span class="rounded bg-white/70 px-1.5 py-px" data-testid="outbox-other-account">
			Another account is signed in on the server; these changes are only sent once their own account signs in again.
		</span>
	{/if}
	{#if queuedCount > 0}
		<span class="rounded bg-white/70 px-1.5 py-px" data-testid="outbox-queued-count">{changes(queuedCount)} waiting</span>
	{/if}
	{#if heldCount > 0}
		<button
			type="button"
			class="rounded btn-danger px-2 py-0.5 pointer-coarse:py-2"
			onclick={() => (isHeldPanelOpen = true)}
			data-testid="outbox-review-held"
		>
			Review {changes(heldCount)} that need a decision
		</button>
	{/if}
{/snippet}

{#if connectivity.isOffline}
	<div
		class="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900"
		role="status"
		aria-live="polite"
		data-testid="connection-status-offline"
	>
		<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-amber-600" aria-hidden="true"></span>
		<!-- In a span, so on a narrow screen the text wraps beside the dot, not under it -->
		<span class="min-w-0 flex-[1_1_12rem]">{offlineMessage}</span>
		{@render outboxSummary()}
	</div>
{:else if queuedCount > 0 || heldCount > 0}
	<div
		class="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900"
		role="status"
		aria-live="polite"
		data-testid="connection-status-outbox"
	>
		<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-sky-600" aria-hidden="true"></span>
		<span class="min-w-0 flex-[1_1_12rem]">{queuedCount > 0 ? (outbox.replaying ? 'Sending changes made offline…' : 'Changes made offline are waiting to be sent.') : 'Changes made offline were sent, except:'}</span>
		{@render outboxSummary()}
	</div>
{:else if connectivity.recentlyReconnected}
	<div
		class="flex flex-shrink-0 items-center gap-2 border-b border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800"
		role="status"
		aria-live="polite"
		data-testid="connection-status-online"
	>
		<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-green-600" aria-hidden="true"></span>
		Back online.
	</div>
{/if}

{#if isHeldPanelOpen}
	<OutboxHeldPanel onClose={() => (isHeldPanelOpen = false)} />
{/if}
