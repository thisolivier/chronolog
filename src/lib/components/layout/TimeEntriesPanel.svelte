<script lang="ts">
	import { onMount } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { resolveRoute } from '$app/paths';
	import WeekSectionHeader from '$lib/components/weekly/WeekSectionHeader.svelte';
	import TimeEntryCard from '$lib/components/weekly/TimeEntryCard.svelte';
	import { getMondayOfWeek, getIsoWeekNumber, getIsoYear } from '$lib/utils/iso-week';
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

	// Get the current week's Monday as starting point
	const today = new SvelteDate();
	const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	let currentWeekMonday = getMondayOfWeek(todayString);

	// Calculate week starts for initial batch (current week + 3 previous)
	function getWeekStarts(startWeek: string, count: number): string[] {
		const starts: string[] = [];
		let currentDate = new SvelteDate(startWeek + 'T00:00:00');

		for (let index = 0; index < count; index++) {
			starts.push(formatDate(currentDate));
			// Move back 7 days for previous week
			currentDate.setDate(currentDate.getDate() - 7);
		}

		return starts;
	}

	function formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	async function loadWeeks(weekStarts: string[]): Promise<WeekData[]> {
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
			const loadedWeeks = await loadWeeks(weekStarts);
			weeks = loadedWeeks;
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
			// Get the oldest week currently loaded
			const oldestWeek = weeks[weeks.length - 1];
			if (!oldestWeek) return;

			// Calculate the Monday one week before the oldest week
			const oldestDate = new SvelteDate(oldestWeek.weekStart + 'T00:00:00');
			oldestDate.setDate(oldestDate.getDate() - 7);
			const nextStartWeek = formatDate(oldestDate);

			const weekStarts = getWeekStarts(nextStartWeek, WEEKS_PER_BATCH);
			const loadedWeeks = await loadWeeks(weekStarts);

			weeks = [...weeks, ...loadedWeeks];

			// For now, always allow loading more. In production, you might want to set a limit
			// or check if we've reached a certain date in the past
		} catch (error) {
			console.error('Error loading more weeks:', error);
		} finally {
			isLoading = false;
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

			// Update local state
			const weekIndex = weeks.findIndex((week) => week.weekStart === weekStart);
			if (weekIndex !== -1) {
				weeks[weekIndex].status = newStatus;
			}
		} catch (error) {
			console.error('Error updating status:', error);
			alert('Failed to update status. Please try again.');
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
	<!-- Header with actions -->
	<div class="border-b border-gray-200 bg-white px-6 py-4">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold text-gray-900">Time Entries</h1>
			<a
				href={resolveRoute('/time/new', {})}
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
			>
				Add Entry
			</a>
		</div>
	</div>

	<!-- Scrollable content -->
	<div class="flex-1 overflow-y-auto px-6 py-6">
		{#if isLoading && weeks.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-gray-500">Loading weeks...</p>
			</div>
		{:else}
			{#each weeks as week (week.weekStart)}
				<div
					data-week-start={week.weekStart}
					class="mb-6"
					bind:this={weekSectionRefs[week.weekStart]}
				>
					<WeekSectionHeader
						weekStart={week.weekStart}
						weeklyTotalMinutes={week.weeklyTotalMinutes}
						currentStatus={week.status}
						onStatusChange={(newStatus) => handleStatusChange(week.weekStart, newStatus)}
					/>

					<div class="space-y-4">
						{#each week.days as day (day.date)}
							<!-- Use DaySection but pass TimeEntryCard as the entry component -->
							<div class="mb-4">
								<div class="mb-2 flex items-center justify-between px-1">
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

								{#if day.entries.length > 0}
									<div class="flex flex-col gap-2">
										{#each day.entries as entry (entry.id)}
											<TimeEntryCard {entry} />
										{/each}
									</div>
								{:else}
									<div
										class="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-center"
									>
										<p class="text-xs text-gray-400">No entries</p>
										<a
											href="{resolveRoute('/time/new', {})}?date={day.date}"
											class="text-xs text-blue-500 hover:text-blue-700"
										>
											Add entry
										</a>
									</div>
								{/if}
							</div>
						{/each}
					</div>
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
