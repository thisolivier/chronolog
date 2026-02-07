<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatTimeShort, formatDuration } from '$lib/utils/iso-week';

	type EntryData = {
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
		date: string;
	};

	let { entry }: { entry: EntryData } = $props();

	let isConfirmingDelete = $state(false);

	function buildContextLabel(): string {
		const parts = [entry.clientName, entry.contractName];
		if (entry.deliverableName) parts.push(entry.deliverableName);
		if (entry.workTypeName) parts.push(entry.workTypeName);
		return parts.join(' / ');
	}

	function buildTimeRange(): string {
		if (entry.startTime && entry.endTime) {
			return `${formatTimeShort(entry.startTime)}-${formatTimeShort(entry.endTime)}`;
		}
		return formatDuration(entry.durationMinutes);
	}
</script>

<div
	class="flex items-start gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-gray-50"
>
	<div class="w-24 shrink-0 pt-0.5 text-sm font-medium text-gray-500">
		{buildTimeRange()}
	</div>

	<div class="min-w-0 flex-1">
		<div class="text-sm font-medium text-gray-900">
			{buildContextLabel()}
		</div>
		{#if entry.description}
			<div class="mt-0.5 text-sm text-gray-600">
				{entry.description}
			</div>
		{/if}
	</div>

	<div class="flex shrink-0 items-center gap-2">
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
				<form method="POST" action="/time?/delete" use:enhance>
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
