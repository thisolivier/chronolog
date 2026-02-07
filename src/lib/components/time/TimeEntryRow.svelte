<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		entry
	}: {
		entry: {
			id: string;
			startTime: string | null;
			endTime: string | null;
			durationMinutes: number;
			contractName: string;
			clientName: string;
			clientShortCode: string;
			deliverableName: string | null;
			workTypeName: string | null;
			description: string | null;
		};
	} = $props();

	let isConfirmingDelete = $state(false);

	function formatTime(timeString: string | null): string {
		if (!timeString) return '--:--';
		return timeString.substring(0, 5);
	}

	function formatDuration(totalMinutes: number): string {
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	}

	function buildContextLabel(): string {
		const parts = [entry.clientShortCode, entry.contractName];
		if (entry.deliverableName) parts.push(entry.deliverableName);
		if (entry.workTypeName) parts.push(entry.workTypeName);
		return parts.join(' / ');
	}
</script>

<div class="flex items-start gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0">
	<div class="w-28 shrink-0 text-sm text-gray-500">
		{formatTime(entry.startTime)}-{formatTime(entry.endTime)}
	</div>

	<div class="min-w-0 flex-1">
		<div class="text-sm font-medium text-gray-900">
			{buildContextLabel()}
		</div>
		{#if entry.description}
			<div class="mt-0.5 truncate text-sm text-gray-600">
				{entry.description}
			</div>
		{/if}
	</div>

	<div class="flex shrink-0 items-center gap-3">
		<span class="text-sm font-medium text-gray-700">
			{formatDuration(entry.durationMinutes)}
		</span>

		<div class="flex items-center gap-1">
			<a
				href="/time/new?edit={entry.id}"
				class="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
			>
				Edit
			</a>

			{#if isConfirmingDelete}
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="entry_id" value={entry.id} />
					<button
						type="submit"
						class="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
					>
						Confirm
					</button>
				</form>
				<button
					onclick={() => (isConfirmingDelete = false)}
					class="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
				>
					Cancel
				</button>
			{:else}
				<button
					onclick={() => (isConfirmingDelete = true)}
					class="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
				>
					Delete
				</button>
			{/if}
		</div>
	</div>
</div>
