<script lang="ts">
	import { onMount } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import WeekSectionHeader from '$lib/components/weekly/WeekSectionHeader.svelte';
	import TimeEntryCard from '$lib/components/weekly/TimeEntryCard.svelte';
	import InlineAddEntry from '$lib/components/weekly/InlineAddEntry.svelte';
	import { getMondayOfWeek, getIsoWeekNumber, getIsoYear, formatWeekStartShort } from '$lib/utils/iso-week';
	import { SvelteDate } from 'svelte/reactivity';

	type WeekData = {
		weekStart: string;
		days: Array<{
			date: string;
			entries: Array<{
				id: string;
				startTime: string | null;
				endTime: string | null;
				durationMinutes: number;
				contractId: string;
				contractName: string;
				clientName: string;
				clientShortCode: string;
				deliverableName: string | null;
				workTypeName: string | null;
				description: string | null;
				date: string;
			}>;
			totalMinutes: number;
		}>;
		weeklyTotalMinutes: number;
		status: string;
	};

	const navigation = getNavigationContext();

	let weeks = $state<WeekData[]>([]);
	let isLoading = $state(false);
	let hasMoreWeeks = $state(true);
	let weekSectionRefs: Record<string, HTMLElement> = {};

	const WEEKS_PER_BATCH = 4;

	// Get the current week's Monday and today's date for filtering
	const today = new SvelteDate();
	const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	let currentWeekMonday = getMondayOfWeek(todayString);

	function formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function getWeekStarts(startWeek: string, count: number): string[] {
		const starts: string[] = [];
		let currentDate = new SvelteDate(startWeek + 'T00:00:00');

		for (let index = 0; index < count; index++) {
			starts.push(formatDate(currentDate));
			currentDate.setDate(currentDate.getDate() - 7);
		}

		return starts;
	}

	async function loadWeeksFromApi(weekStarts: string[]): Promise<WeekData[]> {
		const weeksParam = weekStarts.join(',');
		const response = await fetch(`/api/time-entries/weekly?weeks=${weeksParam}`);

		if (!response.ok) {
			throw new Error('Failed to load weeks');
		}

		const data = await response.json();
		return data.weeks;
	}

	async function loadInitialWeeks() {
		isLoading = true;
		try {
			const weekStarts = getWeekStarts(currentWeekMonday, WEEKS_PER_BATCH);
			weeks = await loadWeeksFromApi(weekStarts);
		} catch (error) {
			console.error('Error loading initial weeks:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreWeeks() {
		if (isLoading || !hasMoreWeeks) return;

		isLoading = true;
		try {
			const oldestWeek = weeks[weeks.length - 1];
			if (!oldestWeek) return;

			const oldestDate = new SvelteDate(oldestWeek.weekStart + 'T00:00:00');
			oldestDate.setDate(oldestDate.getDate() - 7);
			const nextStartWeek = formatDate(oldestDate);

			const weekStarts = getWeekStarts(nextStartWeek, WEEKS_PER_BATCH);
			const loadedWeeks = await loadWeeksFromApi(weekStarts);

			weeks = [...weeks, ...loadedWeeks];
		} catch (error) {
			console.error('Error loading more weeks:', error);
		} finally {
			isLoading = false;
		}
	}

	/** Reload all currently loaded weeks (called after add/edit/delete) */
	async function refreshWeeks() {
		try {
			const allWeekStarts = weeks.map((week) => week.weekStart);
			if (allWeekStarts.length === 0) return;
			weeks = await loadWeeksFromApi(allWeekStarts);
		} catch (error) {
			console.error('Error refreshing weeks:', error);
		}
	}

	async function handleStatusChange(weekStart: string, newStatus: string) {
		const year = getIsoYear(weekStart);
		const weekNumber = getIsoWeekNumber(weekStart);

		try {
			const response = await fetch('/api/time-entries/weekly-statuses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ year, weekNumber, status: newStatus })
			});

			if (!response.ok) {
				throw new Error('Failed to update status');
			}

			const weekIndex = weeks.findIndex((week) => week.weekStart === weekStart);
			if (weekIndex !== -1) {
				weeks[weekIndex].status = newStatus;
			}
		} catch (error) {
			console.error('Error updating status:', error);
		}
	}

	// Scroll to selected week when it changes
	$effect(() => {
		const selectedWeek = navigation.selectedWeek;
		if (selectedWeek && weekSectionRefs[selectedWeek]) {
			const element = weekSectionRefs[selectedWeek];
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});

	onMount(() => {
		loadInitialWeeks();
	});
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-50">
	<!-- Mobile-only header (no Add Entry button) -->
	<div class="border-b border-gray-200 bg-white px-6 py-4 md:hidden">
		<h1 class="text-xl font-bold text-gray-900">Time Entries</h1>
	</div>

	<!-- Scrollable content -->
	<div class="flex-1 overflow-y-auto px-6 py-4">
		{#if isLoading && weeks.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-gray-500">Loading weeks...</p>
			</div>
		{:else}
			{#each weeks as week (week.weekStart)}
				<div
					data-week-start={week.weekStart}
					bind:this={weekSectionRefs[week.weekStart]}
				>
					{#if week.weeklyTotalMinutes === 0}
						<!-- Empty week: heading only with suffix -->
						<div class="mb-3 mt-6 first:mt-0">
							<h1 class="text-lg font-bold text-gray-400">
								{formatWeekStartShort(week.weekStart)}
								<span class="font-normal"> &mdash; No entries this week</span>
							</h1>
						</div>
					{:else}
						<!-- Non-empty week: full breakdown, days in descending order, future days hidden -->
						<WeekSectionHeader
							weekStart={week.weekStart}
							weeklyTotalMinutes={week.weeklyTotalMinutes}
							currentStatus={week.status}
							onStatusChange={(newStatus) => handleStatusChange(week.weekStart, newStatus)}
						/>

						{#each [...week.days].reverse() as day (day.date)}
							{#if day.date <= todayString}
								{#if day.entries.length > 0 || day.totalMinutes > 0}
									<div class="mb-3">
										<div class="mb-1 flex items-center justify-between px-1">
											<h3 class="text-sm font-semibold text-gray-700">
												{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
													weekday: 'long',
													month: 'short',
													day: 'numeric'
												})}
											</h3>
											{#if day.totalMinutes > 0}
												<span class="text-sm font-medium text-gray-500">
													{Math.round((day.totalMinutes / 60) * 10) / 10} hrs
												</span>
											{/if}
										</div>

										{#each day.entries as entry (entry.id)}
											<TimeEntryCard {entry} onUpdated={refreshWeeks} />
										{/each}

										<InlineAddEntry date={day.date} onEntryCreated={refreshWeeks} />
									</div>
								{:else}
									<div class="mb-1">
										<div class="flex items-center gap-2 px-1 py-0.5">
											<span class="text-xs text-gray-400">
												{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
													weekday: 'short',
													month: 'short',
													day: 'numeric'
												})}
											</span>
										</div>
										<InlineAddEntry date={day.date} onEntryCreated={refreshWeeks} />
									</div>
								{/if}
							{/if}
						{/each}
					{/if}
				</div>
			{/each}

			<!-- Load more button -->
			{#if hasMoreWeeks}
				<div class="flex justify-center py-6">
					<button
						onclick={loadMoreWeeks}
						disabled={isLoading}
						class="rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
					>
						{isLoading ? 'Loading...' : 'Load more weeks'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
