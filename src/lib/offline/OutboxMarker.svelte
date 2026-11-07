<!--
	OutboxMarker — a small tag on a note row, the note header or a time entry card (sprint 045-CL):
	"queued" while the change waits on this device, "held" when it needs a decision, "replayed"
	for the rest of the session once it reached the server.
-->
<script lang="ts">
	import { outbox } from './outbox-store.svelte';

	/** `otherKey`: the same row under the temp ID it was created with offline, if any */
	let { resourceKey, otherKey = null }: { resourceKey: string; otherKey?: string | null } = $props();

	const status = $derived(outbox.statusOf(resourceKey) ?? (otherKey ? outbox.statusOf(otherKey) : null));
	const styles = {
		queued: 'bg-ochre-100 text-ochre-800',
		held: 'bg-rust-100 text-rust-700',
		replayed: 'bg-leaf-100 text-leaf-800'
	} as const;
	const titles = {
		queued: 'Saved on this device; it goes to the server when you are back online',
		held: 'Changed on the server too: open the banner to choose which version to keep',
		replayed: 'Made offline and sent to the server when you reconnected'
	} as const;
</script>

{#if status}
	<span
		class="inline-flex flex-shrink-0 items-center rounded px-1 py-px text-[10px] leading-tight font-medium {styles[status]}"
		title={titles[status]}
		data-testid="outbox-marker"
		data-outbox-status={status}
	>
		{status}
	</span>
{/if}
