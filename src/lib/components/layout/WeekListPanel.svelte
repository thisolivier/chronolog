<!--
	WeekListPanel - Panel 2 content for time entries mode

	Usage:
	<AppShell panel1={sidebar} panel2={weekList} panel3={content}>
		{#snippet weekList()}
			<WeekListPanel />
		{/snippet}
	</AppShell>

	Features:
	- Displays a scrollable list of weeks with summaries
	- Highlights the currently selected week from navigation context
	- Infinite scroll with "Load More" button for older weeks
	- Filters out empty weeks (except the current week)
	- Each week shows: formatted date, total hours, status badge
	- Clicking a week calls navigationContext.selectWeek(weekStart)
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import {
		formatWeekStartShort,
		formatHoursFromMinutes,
		getMondayOfWeek
	} from '$lib/utils/iso-week';

	type WeekSummary = {
		weekStart: string;
		year: number;
		weekNumber: number;
		totalMinutes: number;
		status: string;
	};

	const navigationContext = getNavigationContext();

	let weeks = $state<WeekSummary[]>([]);
	let isLoading = $state(true);
	let isLoadingMore = $state(false);
	let hasMore = $state(true);
	let error = $state<string | null>(null);

	const WEEKS_PER_PAGE = 12;

	// Current week's Monday for filtering logic
	const todayString = new Date().toISOString().split('T')[0];
	const currentWeekMonday = getMondayOfWeek(todayString);

	/** Filter weeks: hide empty weeks unless they are the current week */
	const displayedWeeks = $derived(
		weeks.filter(
			(week) => week.totalMinutes > 0 || week.weekStart === currentWeekMonday
		)
	);

	async function loadWeeks() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/weeks?count=${WEEKS_PER_PAGE}`);
			if (!response.ok) {
				throw new Error('Failed to load weeks');
			}

			const data = await response.json();
			weeks = data.weeks ?? [];
			hasMore = weeks.length >= WEEKS_PER_PAGE;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			console.error('Error loading weeks:', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreWeeks() {
		if (isLoadingMore || !hasMore || weeks.length === 0) {
			return;
		}

		isLoadingMore = true;
		error = null;

		try {
			const oldestWeek = weeks[weeks.length - 1];
			const response = await fetch(
				`/api/weeks?count=${WEEKS_PER_PAGE}&before=${oldestWeek.weekStart}`
			);
			if (!response.ok) {
				throw new Error('Failed to load more weeks');
			}

			const data = await response.json();
			const newWeeks = data.weeks ?? [];

			const filteredNewWeeks = newWeeks.filter(
				(week: WeekSummary) => week.weekStart !== oldestWeek.weekStart
			);

			weeks = [...weeks, ...filteredNewWeeks];
			hasMore = filteredNewWeeks.length >= WEEKS_PER_PAGE - 1;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			console.error('Error loading more weeks:', err);
		} finally {
			isLoadingMore = false;
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'Submitted':
				return 'bg-green-500';
			case 'Draft ready':
				return 'bg-yellow-500';
			case 'Unsubmitted':
			default:
				return 'bg-gray-400';
		}
	}

	function handleWeekClick(weekStart: string) {
		navigationContext.selectWeek(weekStart);
	}

	onMount(() => {
		loadWeeks();
	});
</script>

<div class="flex h-full flex-col bg-gray-50">
	<!-- Mobile-only header (no button) -->
	<div class="flex items-center border-b border-gray-200 bg-white px-4 py-3 md:hidden">
		<h2 class="text-sm font-semibold text-gray-900">Time Entries</h2>
	</div>

	<!-- Week list -->
	<div class="flex-1 overflow-y-auto">
		{#if isLoading}
			<div class="flex items-center justify-center py-8">
				<div class="text-sm text-gray-500">Loading weeks...</div>
			</div>
		{:else if error}
			<div class="mx-4 mt-4 rounded-md bg-red-50 p-4">
				<p class="text-sm text-red-800">{error}</p>
			</div>
		{:else if displayedWeeks.length === 0}
			<div class="flex items-center justify-center py-8">
				<div class="text-sm text-gray-500">No weeks found</div>
			</div>
		{:else}
			<div class="divide-y divide-gray-200">
				{#each displayedWeeks as week (week.weekStart)}
					{@const isSelected = navigationContext.selectedWeek === week.weekStart}
					<button
						onclick={() => handleWeekClick(week.weekStart)}
						class="block w-full text-left transition-colors hover:bg-gray-100
							{isSelected ? 'border-l-2 border-blue-600 bg-blue-50' : 'border-l-2 border-transparent'}"
					>
						<div class="px-4 py-3">
							<!-- Week date and hours -->
							<div class="mb-1 flex items-center justify-between">
								<span class="text-sm font-medium text-gray-900">
									{formatWeekStartShort(week.weekStart)}
								</span>
								<span class="text-xs font-medium text-gray-600">
									{formatHoursFromMinutes(week.totalMinutes)}
								</span>
							</div>

							<!-- Status badge -->
							<div class="flex items-center gap-2">
								<div class="h-2 w-2 rounded-full {getStatusColor(week.status)}"></div>
								<span class="text-xs text-gray-600">{week.status}</span>
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Load more button -->
			{#if hasMore}
				<div class="border-t border-gray-200 p-4">
					<button
						onclick={loadMoreWeeks}
						disabled={isLoadingMore}
						class="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700
							hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isLoadingMore ? 'Loading...' : 'Load More'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
