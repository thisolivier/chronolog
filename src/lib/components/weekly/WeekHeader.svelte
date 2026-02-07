<script lang="ts">
	import { enhance } from '$app/forms';
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
		onNavigatePrevious,
		onNavigateNext,
		onNavigateCurrent
	}: {
		weekStart: string;
		weeklyTotalMinutes: number;
		currentStatus: string;
		onNavigatePrevious: () => void;
		onNavigateNext: () => void;
		onNavigateCurrent: () => void;
	} = $props();

	const weekNumber = $derived(getIsoWeekNumber(weekStart));
	const isoYear = $derived(getIsoYear(weekStart));

	const statusOptions = ['Unsubmitted', 'Draft ready', 'Submitted'];
</script>

<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
	<!-- Navigation row -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<button
				onclick={onNavigatePrevious}
				class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				aria-label="Previous week"
			>
				Previous
			</button>
			<button
				onclick={onNavigateCurrent}
				class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
			>
				This Week
			</button>
			<button
				onclick={onNavigateNext}
				class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				aria-label="Next week"
			>
				Next
			</button>
		</div>
		<a
			href="/time/new"
			class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
		>
			Add Entry
		</a>
	</div>

	<!-- Week title and total -->
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-bold text-gray-900">
			Week {weekNumber} &mdash; {formatWeekRange(weekStart)}
		</h2>
		<span class="text-lg font-semibold text-gray-700">
			{formatHoursFromMinutes(weeklyTotalMinutes)}
		</span>
	</div>

	<!-- Status row -->
	<div class="mt-2">
		<form method="POST" action="?/updateStatus" use:enhance class="flex items-center gap-2">
			<input type="hidden" name="year" value={isoYear} />
			<input type="hidden" name="week_number" value={weekNumber} />
			<label for="weekly-status" class="text-sm font-medium text-gray-600">Status:</label>
			<select
				id="weekly-status"
				name="status"
				class="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				onchange={(event) => {
					const form = (event.target as HTMLSelectElement).closest('form');
					if (form) form.requestSubmit();
				}}
			>
				{#each statusOptions as option (option)}
					<option value={option} selected={currentStatus === option}>{option}</option>
				{/each}
			</select>
		</form>
	</div>
</div>
