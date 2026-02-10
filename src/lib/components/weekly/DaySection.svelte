<script lang="ts">
	import WeeklyEntryRow from './WeeklyEntryRow.svelte';
	import { formatDayHeader, formatHoursFromMinutes } from '$lib/utils/iso-week';

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

	type DayGroupData = {
		date: string;
		entries: EntryData[];
		totalMinutes: number;
	};

	let { dayGroup }: { dayGroup: DayGroupData } = $props();

	const hasEntries = $derived(dayGroup.entries.length > 0);
</script>

<div class="mb-4">
	<div class="mb-2 flex items-center justify-between px-1">
		<h3 class="text-sm font-bold text-gray-700">
			{formatDayHeader(dayGroup.date)}
		</h3>
		{#if dayGroup.totalMinutes > 0}
			<span class="text-sm font-medium text-gray-500">
				{formatHoursFromMinutes(dayGroup.totalMinutes)}
			</span>
		{/if}
	</div>

	{#if hasEntries}
		<div class="flex flex-col gap-2">
			{#each dayGroup.entries as entry (entry.id)}
				<WeeklyEntryRow {entry} />
			{/each}
		</div>
	{/if}

	<div class="px-1 {hasEntries ? 'mt-1' : ''}">
		<a
			href="/time/new?date={dayGroup.date}"
			class="text-xs text-blue-500 hover:text-blue-700"
		>
			Add entry
		</a>
	</div>
</div>
