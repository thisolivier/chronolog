<!--
	FirstRunNotice — shown above the timesheet and the notes list while the person has no client
	of their own (only the seeded Internal / General). Points to Settings → Clients and contracts.
	Re-checks whenever the sidebar reloads its contracts, so it disappears once a client is added.
-->
<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';
	import { CLIENTS_SETTINGS_HREF, hasNoOwnClients } from './first-run';

	let { compact = false }: { compact?: boolean } = $props();

	const dataService = getDataService();
	let isFirstRun = $state(false);
	let requestCounter = 0;

	async function refresh() {
		const requestNumber = ++requestCounter;
		try {
			const clients = await dataService.getClients();
			if (requestNumber === requestCounter) isFirstRun = hasNoOwnClients(clients);
		} catch {
			// Offline or signed out: say nothing rather than guess
		}
	}

	$effect(() => {
		// Track the sidebar's contract list: it reloads after New Contract and admin changes
		void contractDirectory.labels;
		void refresh();
	});
</script>

{#if isFirstRun}
	<div
		class="flex-shrink-0 border-b border-amber-200 bg-amber-50 text-stone-700 {compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm sm:px-6'}"
		role="note"
		data-testid="first-run-notice"
	>
		<p>
			<span class="font-medium text-stone-900">No clients yet.</span>
			Clients and contracts are created under
			<a href={CLIENTS_SETTINGS_HREF} class="font-medium text-blue-700 underline hover:text-blue-900">Settings → Clients and contracts</a>.
			{#if !compact}Until then, time and notes can go on the starter Internal client.{/if}
		</p>
	</div>
{/if}
