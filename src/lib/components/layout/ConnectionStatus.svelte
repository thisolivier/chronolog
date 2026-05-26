<script lang="ts">
	/**
	 * ConnectionStatus — shows online/offline and sync state.
	 * Renders a small banner when offline or syncing, and nothing (or a subtle dot) when online.
	 */

	let isOnline = $state(true);
	let isSyncing = $state(false);

	// Track browser online/offline events
	$effect(() => {
		isOnline = navigator.onLine;

		const handleOnline = () => {
			isOnline = true;
			// Brief syncing indication after reconnect
			isSyncing = true;
			setTimeout(() => {
				isSyncing = false;
			}, 3000);
		};

		const handleOffline = () => {
			isOnline = false;
			isSyncing = false;
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});
</script>

{#if !isOnline}
	<div
		class="flex items-center gap-2 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border-b border-amber-200"
		role="status"
		aria-live="polite"
		data-testid="connection-status-offline"
	>
		<span class="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
		Offline — changes are saved locally
	</div>
{:else if isSyncing}
	<div
		class="flex items-center gap-2 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 border-b border-blue-200"
		role="status"
		aria-live="polite"
		data-testid="connection-status-syncing"
	>
		<span class="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
		Syncing...
	</div>
{/if}
