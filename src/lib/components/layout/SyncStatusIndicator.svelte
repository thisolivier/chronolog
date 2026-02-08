<script lang="ts">
	/**
	 * SyncStatusIndicator — Compact status bar for offline sync
	 *
	 * Shows pending (unsynced) mutation count and/or session expired warning.
	 * Only renders when there is something to display.
	 */

	import { getDataService } from '$lib/sync/context';

	const dataService = getDataService();
</script>

{#if dataService && (dataService.pendingCount > 0 || dataService.authExpired)}
	<div class="flex items-center gap-2 px-3 py-1.5 text-xs">
		{#if dataService.pendingCount > 0}
			<span class="inline-flex items-center gap-1 text-amber-600">
				<span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"></span>
				{dataService.pendingCount} unsynced
			</span>
		{/if}

		{#if dataService.authExpired}
			<a
				href="/login"
				class="text-red-600 underline underline-offset-2 hover:text-red-800"
			>
				Session expired — log in
			</a>
		{/if}
	</div>
{/if}
