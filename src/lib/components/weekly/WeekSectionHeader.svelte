<script lang="ts">
	import {
		formatWeekRange,
		formatHoursFromMinutes,
		getIsoWeekNumber,
		getIsoYear
	} from '$lib/utils/iso-week';

	let {
		weekStart,
		weeklyTotalMinutes,
		currentStatus,
		onStatusChange
	}: {
		weekStart: string;
		weeklyTotalMinutes: number;
		currentStatus: string;
		onStatusChange: (newStatus: string) => void;
	} = $props();

	const weekNumber = $derived(getIsoWeekNumber(weekStart));
	const isoYear = $derived(getIsoYear(weekStart));

	const statusOptions = ['Unsubmitted', 'Draft ready', 'Submitted'];

	async function handleStatusChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const newStatus = select.value;
		await onStatusChange(newStatus);
	}
</script>

<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<!-- Week title and total -->
	<div class="mb-2 flex items-center justify-between">
		<h2 class="text-lg font-bold text-gray-900">
			Week {weekNumber} &mdash; {formatWeekRange(weekStart)}
		</h2>
		<span class="text-lg font-semibold text-gray-700">
			{formatHoursFromMinutes(weeklyTotalMinutes)}
		</span>
	</div>

	<!-- Status row -->
	<div class="flex items-center gap-2">
		<label for="weekly-status-{isoYear}-{weekNumber}" class="text-sm font-medium text-gray-600">
			Status:
		</label>
		<select
			id="weekly-status-{isoYear}-{weekNumber}"
			class="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			onchange={handleStatusChange}
		>
			{#each statusOptions as option (option)}
				<option value={option} selected={currentStatus === option}>{option}</option>
			{/each}
		</select>
	</div>
</div>
