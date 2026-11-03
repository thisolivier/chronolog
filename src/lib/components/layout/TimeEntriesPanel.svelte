<script lang="ts">
	import { onMount } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import WeekStrip from '$lib/components/weekly/WeekStrip.svelte';
	import TimeEntryCard from '$lib/components/weekly/TimeEntryCard.svelte';
	import NewEntryRow from '$lib/components/weekly/NewEntryRow.svelte';
	import { getMondayOfWeek, getIsoWeekNumber, getIsoYear, getWeekDates, formatDayHeader } from '$lib/utils/iso-week';
	import { SvelteDate } from 'svelte/reactivity';
	import { TIME_ENTRY_SAVED_EVENT, readTimeEntrySavedDetail } from '$lib/components/weekly/time-entry-events';
	import type { WeekData, TimeEntryDisplay } from '$lib/services/types';

	const navigation = getNavigationContext();
	const dataService = getDataService();

	let loadedWeeks = $state<WeekData[]>([]);
	let isLoading = $state(false);
	let hasMoreWeeks = $state(true);
	let daySectionRefs: Record<string, HTMLElement> = {};

	// UI state for add-entry
	let expandedAddEntry: Record<string, boolean> = $state({});

	// Get today's date for filtering future days
	const today = new SvelteDate();
	const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	let currentWeekMonday = getMondayOfWeek(todayString);

	// The selected week comes from navigation context, defaulting to current week
	let selectedWeekStart = $derived(navigation.selectedWeek ?? currentWeekMonday);

	// Find the selected week's data from loaded weeks
	let selectedWeekData = $derived(
		loadedWeeks.find((week) => week.weekStart === selectedWeekStart) ?? null
	);

	// Build the days array for WeekStrip from the selected week's data
	let weekStripDays = $derived(
		getWeekDates(selectedWeekStart).map((date) => {
			const dayData = selectedWeekData?.days.find((day) => day.date === date);
			return {
				date,
				totalMinutes: dayData?.totalMinutes ?? 0,
				entries: dayData?.entries.map((entry) => ({
					clientId: entry.clientId ?? entry.clientShortCode,
					clientColorIndex: entry.clientColorIndex,
					durationMinutes: entry.durationMinutes
				})) ?? []
			};
		})
	);

	// Get the days to display (up to today for the selected week)
	let displayDays = $derived(getWeekDaysUpToToday(selectedWeekStart));

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
		return dataService.getWeeklyTimeEntries(weekStarts);
	}

	async function loadInitialWeeks() {
		isLoading = true;
		try {
			const weekStarts = getWeekStarts(currentWeekMonday, 4);
			loadedWeeks = await loadWeeksFromApi(weekStarts);
		} catch (error) {
			console.error('Error loading initial weeks:', error);
		} finally {
			isLoading = false;
		}
	}

	/** Load a single week's data and merge it into the loaded weeks cache */
	async function ensureWeekLoaded(weekStart: string) {
		const alreadyLoaded = loadedWeeks.some((week) => week.weekStart === weekStart);
		if (alreadyLoaded) return;

		isLoading = true;
		try {
			const newWeeks = await loadWeeksFromApi([weekStart]);
			// Insert in chronological order (newest first)
			const allWeeks = [...loadedWeeks, ...newWeeks];
			allWeeks.sort((weekA, weekB) => weekB.weekStart.localeCompare(weekA.weekStart));
			loadedWeeks = allWeeks;
		} catch (error) {
			console.error('Error loading week:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadMoreWeeks() {
		if (isLoading || !hasMoreWeeks) return;

		isLoading = true;
		try {
			const oldestWeek = loadedWeeks[loadedWeeks.length - 1];
			if (!oldestWeek) return;

			const oldestDate = new SvelteDate(oldestWeek.weekStart + 'T00:00:00');
			oldestDate.setDate(oldestDate.getDate() - 7);
			const nextStartWeek = formatDate(oldestDate);

			const weekStarts = getWeekStarts(nextStartWeek, 4);
			const fetchedWeeks = await loadWeeksFromApi(weekStarts);

			loadedWeeks = [...loadedWeeks, ...fetchedWeeks];
		} catch (error) {
			console.error('Error loading more weeks:', error);
		} finally {
			isLoading = false;
		}
	}

	/** Reload all currently loaded weeks (called after add/edit/delete) */
	async function refreshWeeks() {
		try {
			const allWeekStarts = loadedWeeks.map((week) => week.weekStart);
			if (allWeekStarts.length === 0) return;
			loadedWeeks = await loadWeeksFromApi(allWeekStarts);
		} catch (error) {
			console.error('Error refreshing weeks:', error);
		}
	}

	async function handleStatusChange(weekStart: string, newStatus: string) {
		const year = getIsoYear(weekStart);
		const weekNumber = getIsoWeekNumber(weekStart);

		try {
			await dataService.updateWeeklyStatus(year, weekNumber, newStatus);

			const weekIndex = loadedWeeks.findIndex((week) => week.weekStart === weekStart);
			if (weekIndex !== -1) {
				loadedWeeks[weekIndex].status = newStatus;
			}
		} catch (error) {
			console.error('Error updating status:', error);
		}
	}

	function toggleAddEntry(dateKey: string) {
		expandedAddEntry[dateKey] = !expandedAddEntry[dateKey];
	}

	function handleEntryCreated(dateKey: string) {
		expandedAddEntry[dateKey] = false;
		refreshWeeks();
	}

	/** An entry was saved by the timer widget or the Add Entry modal (sidebar) */
	async function handleTimeEntrySaved(event: Event) {
		const { date } = readTimeEntrySavedDetail(event);
		await refreshWeeks();
		if (date) {
			await ensureWeekLoaded(getMondayOfWeek(date));
		}
	}

	/** A [[noteId]] link in a card was clicked: switch to notes mode and open that note */
	async function handleNoteLinkClick(noteId: string) {
		try {
			const note = await dataService.getNoteById(noteId);
			const contracts = await dataService.getContracts();
			const owningContract = contracts.find((contract) => contract.id === note.contractId);
			if (!owningContract) {
				console.error(`Contract ${note.contractId} for note ${noteId} not found`);
				return;
			}
			navigation.openNote(noteId, owningContract.id, owningContract.clientId);
		} catch (error) {
			console.error(`Could not open note ${noteId}:`, error);
		}
	}

	/** Get all dates in a week up to today */
	function getWeekDaysUpToToday(weekStart: string): string[] {
		return getWeekDates(weekStart).filter((dateString) => dateString <= todayString);
	}

	/** Find the day data for a given date in the selected week */
	function findDayDataForDate(dateString: string) {
		if (!selectedWeekData) return null;
		return selectedWeekData.days.find((day) => day.date === dateString) ?? null;
	}

	/** Get a month label for month dividers */
	function getMonthLabel(dateString: string): string {
		const date = new Date(dateString + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
	}

	// --- Week navigation handlers ---

	function navigateToPrevWeek() {
		const currentSelectedDate = new SvelteDate(selectedWeekStart + 'T00:00:00');
		currentSelectedDate.setDate(currentSelectedDate.getDate() - 7);
		const previousWeekStart = formatDate(currentSelectedDate);
		navigation.selectWeek(previousWeekStart);
		ensureWeekLoaded(previousWeekStart);
	}

	function navigateToNextWeek() {
		const currentSelectedDate = new SvelteDate(selectedWeekStart + 'T00:00:00');
		currentSelectedDate.setDate(currentSelectedDate.getDate() + 7);
		const nextWeekStart = formatDate(currentSelectedDate);
		navigation.selectWeek(nextWeekStart);
		ensureWeekLoaded(nextWeekStart);
	}

	function handleDayClick(dateString: string) {
		const targetElement = daySectionRefs[dateString];
		if (targetElement) {
			targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	// When selectedWeek changes externally, ensure that week is loaded
	$effect(() => {
		const weekToLoad = selectedWeekStart;
		ensureWeekLoaded(weekToLoad);
	});

	onMount(() => {
		window.addEventListener(TIME_ENTRY_SAVED_EVENT, handleTimeEntrySaved);
		loadInitialWeeks().then(() => {
			// Brief delay to let DOM render, then scroll to today's section
			setTimeout(() => {
				const todayRef = daySectionRefs[todayString];
				if (todayRef) {
					todayRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 100);
		});
		return () => {
			window.removeEventListener(TIME_ENTRY_SAVED_EVENT, handleTimeEntrySaved);
		};
	});
</script>

<!--
	Day section snippet used for each day in the selected week.
	"+" button always in the heading row; NewEntryRow expands below heading, above entries.
-->
{#snippet daySection(dayDate: string, entries: TimeEntryDisplay[], totalMinutes: number)}
	{@const isToday = dayDate === todayString}
	<div
		class={['mb-3', isToday && 'rounded-lg bg-amber-50/60 p-3'].filter(Boolean).join(' ')}
		bind:this={daySectionRefs[dayDate]}
	>
		<div class="mb-1 flex items-center justify-between px-1">
			<div class="flex items-center gap-2">
				<h2 class="text-sm font-semibold text-stone-700">
					{formatDayHeader(dayDate)}
				</h2>
				{#if isToday}
					<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">Today</span>
				{/if}
				{#if !expandedAddEntry[dayDate]}
					<button
						onclick={() => toggleAddEntry(dayDate)}
						class="text-sm leading-none text-stone-500 hover:text-blue-500"
						title="Add entry"
					>
						+
					</button>
				{/if}
			</div>
			{#if totalMinutes > 0}
				<span class="text-sm font-medium text-stone-500">
					{Math.round((totalMinutes / 60) * 10) / 10} hrs
				</span>
			{/if}
		</div>

		{#if expandedAddEntry[dayDate]}
			<NewEntryRow
				date={dayDate}
				onEntryCreated={() => handleEntryCreated(dayDate)}
				onCancel={() => toggleAddEntry(dayDate)}
			/>
		{/if}

		{#if entries.length > 0}
			<div class="flex flex-col">
				{#each entries as entry (entry.id)}
					<TimeEntryCard {entry} onUpdated={refreshWeeks} onNoteLinkClick={handleNoteLinkClick} />
				{/each}
			</div>
		{:else if !expandedAddEntry[dayDate]}
			<div class="flex items-center justify-between rounded-lg border border-dashed border-stone-300 px-4 py-3">
				<span class="text-sm italic text-stone-400">No entries</span>
				<button
					onclick={() => toggleAddEntry(dayDate)}
					class="text-sm font-medium text-blue-500 hover:text-blue-700"
				>
					+ Add
				</button>
			</div>
		{/if}
	</div>
{/snippet}

<div class="flex h-full flex-col overflow-hidden bg-stone-50">
	<!-- Mobile-only header -->
	<div class="border-b border-stone-200 bg-white px-6 py-4 md:hidden">
		<h1 class="text-xl font-bold text-stone-900">Time Entries</h1>
	</div>

	<!-- WeekStrip: sticky at the top of the panel -->
	{#if selectedWeekData}
		<WeekStrip
			weekStart={selectedWeekStart}
			days={weekStripDays}
			weeklyTotalMinutes={selectedWeekData.weeklyTotalMinutes}
			currentStatus={selectedWeekData.status}
			onStatusChange={(newStatus) => handleStatusChange(selectedWeekStart, newStatus)}
			onPrevWeek={navigateToPrevWeek}
			onNextWeek={navigateToNextWeek}
			onDayClick={handleDayClick}
		/>
	{:else if !isLoading}
		<!-- Show WeekStrip shell with zeroed-out data while week is loading -->
		<WeekStrip
			weekStart={selectedWeekStart}
			days={weekStripDays}
			weeklyTotalMinutes={0}
			currentStatus="Unsubmitted"
			onStatusChange={(newStatus) => handleStatusChange(selectedWeekStart, newStatus)}
			onPrevWeek={navigateToPrevWeek}
			onNextWeek={navigateToNextWeek}
			onDayClick={handleDayClick}
		/>
	{/if}

	<!-- Scrollable content: selected week's day sections -->
	<div class="flex-1 overflow-y-auto px-6 py-4">
		{#if isLoading && loadedWeeks.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-stone-500">Loading weeks...</p>
			</div>
		{:else}
			{#each displayDays as dayDate, dayIndex (dayDate)}
				{@const dayData = findDayDataForDate(dayDate)}
				{@const previousDayDate = dayIndex > 0 ? displayDays[dayIndex - 1] : null}
				{@const isNewMonth = previousDayDate !== null && dayDate.substring(0, 7) !== previousDayDate.substring(0, 7)}

				{#if isNewMonth}
					<!-- Month divider -->
					<div class="flex items-center gap-3 py-3">
						<div class="h-px flex-1 bg-stone-200"></div>
						<span class="text-xs font-medium uppercase tracking-widest text-stone-400">
							{getMonthLabel(dayDate)}
						</span>
						<div class="h-px flex-1 bg-stone-200"></div>
					</div>
				{/if}

				{@render daySection(dayDate, dayData?.entries ?? [], dayData?.totalMinutes ?? 0)}
			{/each}

			{#if displayDays.length === 0 && !isLoading}
				<div class="flex items-center justify-center py-12">
					<p class="text-stone-500">No days to display for this week.</p>
				</div>
			{/if}

			<!-- Load more weeks (subtle) -->
			{#if hasMoreWeeks}
				<div class="flex justify-center pb-4 pt-2">
					<button
						onclick={loadMoreWeeks}
						disabled={isLoading}
						class="text-sm text-stone-400 hover:text-stone-600 disabled:opacity-50"
					>
						{isLoading ? 'Loading...' : 'Load older weeks'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
