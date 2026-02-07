<script lang="ts">
	import { goto } from '$app/navigation';
	import WeekHeader from '$lib/components/weekly/WeekHeader.svelte';
	import DaySection from '$lib/components/weekly/DaySection.svelte';
	import { getMondayOfWeek } from '$lib/utils/iso-week';

	let { data, form } = $props();

	function navigateToPreviousWeek() {
		const currentMonday = new Date(data.weekStart + 'T00:00:00');
		currentMonday.setDate(currentMonday.getDate() - 7);
		const previousWeekStart = formatDateForUrl(currentMonday);
		goto(`/time?week=${previousWeekStart}`);
	}

	function navigateToNextWeek() {
		const currentMonday = new Date(data.weekStart + 'T00:00:00');
		currentMonday.setDate(currentMonday.getDate() + 7);
		const nextWeekStart = formatDateForUrl(currentMonday);
		goto(`/time?week=${nextWeekStart}`);
	}

	function navigateToCurrentWeek() {
		const todayString = new Date().toISOString().split('T')[0];
		const thisWeekStart = getMondayOfWeek(todayString);
		goto(`/time?week=${thisWeekStart}`);
	}

	function formatDateForUrl(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b border-gray-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
			<div class="flex items-center gap-4">
				<a href="/" class="text-xl font-bold text-gray-900">Chronolog</a>
				<span class="text-gray-400">/</span>
				<span class="text-sm font-medium text-gray-600">Time Entries</span>
			</div>
			<a
				href="/"
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
			>
				Dashboard
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-5xl p-6">
		{#if form?.error}
			<div class="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
				{form.error}
			</div>
		{/if}

		{#if form?.success}
			<div class="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
				Entry deleted successfully.
			</div>
		{/if}

		{#if form?.statusUpdated}
			<div class="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
				Weekly status updated.
			</div>
		{/if}

		<WeekHeader
			weekStart={data.weekStart}
			weeklyTotalMinutes={data.weeklySummary.weeklyTotalMinutes}
			currentStatus={data.weeklyStatus}
			onNavigatePrevious={navigateToPreviousWeek}
			onNavigateNext={navigateToNextWeek}
			onNavigateCurrent={navigateToCurrentWeek}
		/>

		<!-- Day sections: show days with entries first, then empty days -->
		<div class="space-y-2">
			{#each data.weeklySummary.days as dayGroup (dayGroup.date)}
				<DaySection {dayGroup} />
			{/each}
		</div>
	</main>
</div>
