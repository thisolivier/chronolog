<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import WeekStrip from '$lib/components/weekly/WeekStrip.svelte';
	import TimeEntryCard from '$lib/components/weekly/TimeEntryCard.svelte';
	import NewEntryRow from '$lib/components/weekly/NewEntryRow.svelte';
	import TimerWidget from '$lib/components/timer/TimerWidget.svelte';
	import { isSidebarTimerWidgetMounted } from '$lib/components/timer/timer-widget-registry.svelte';
	import {
		getMondayOfWeek,
		getIsoWeekNumber,
		getIsoYear,
		getWeekDates,
		formatDayHeader,
		formatWeekRange
	} from '$lib/utils/iso-week';
	import { formatMinutes } from '$lib/utils/duration';
	import { SvelteDate } from 'svelte/reactivity';
	import { TIME_ENTRY_SAVED_EVENT, readTimeEntrySavedDetail } from '$lib/components/weekly/time-entry-events';
	import type { WeekData, TimeEntryDisplay } from '$lib/services/types';

	const navigation = getNavigationContext();
	const dataService = getDataService();

	let loadedWeeks = $state<WeekData[]>([]);
	let isLoading = $state(false);
	let isLoadingOlderWeek = $state(false);
	let daySectionRefs: Record<string, HTMLElement> = {};
	let scrollContainer: HTMLElement | undefined = $state();

	/**
	 * Scroll the day list so a day sits at the top. Sets scrollTop on the panel's own
	 * scroller instead of calling scrollIntoView, which in Chromium also moves the
	 * sequential focus starting point (the first Tab then landed on today's "+").
	 */
	function scrollDayToTop(dateString: string, behavior: 'auto' | 'smooth') {
		const dayElement = daySectionRefs[dateString];
		if (!dayElement || !scrollContainer) return;
		const offsetWithinContainer =
			dayElement.getBoundingClientRect().top -
			scrollContainer.getBoundingClientRect().top +
			scrollContainer.scrollTop;
		scrollContainer.scrollTo({ top: Math.max(0, offsetWithinContainer - 8), behavior });
	}

	// --- Returning restores (rule 7): each week remembers the day at the top of the list ---
	let highlightedDay = $state<string | null>(null);
	let highlightTimeout: ReturnType<typeof setTimeout> | undefined;
	let positionedFor = '';
	let isPositioning = false;
	let scrollFrame = 0;
	/** Set on teardown: the emptied scroller fires late scroll events that must not overwrite the position */
	let isPanelDestroyed = false;
	/** The week the list has been placed for; scroll positions are only recorded after that */
	let positionedWeek: string | null = null;

	/** Remember where this week is scrolled to: the top visible day and the offset into it */
	function rememberScroll() {
		if (!scrollContainer || isPositioning || isPanelDestroyed || !scrollContainer.isConnected) return;
		if (positionedWeek !== selectedWeekStart) return;
		const containerTop = scrollContainer.getBoundingClientRect().top;
		let topDay: string | null = null;
		let offsetWithinDay = 0;
		for (const dayDate of displayDays) {
			const dayElement = daySectionRefs[dayDate];
			if (!dayElement) continue;
			const box = dayElement.getBoundingClientRect();
			if (box.bottom > containerTop + 8) {
				topDay = dayDate;
				offsetWithinDay = containerTop - box.top;
				break;
			}
		}
		navigation.rememberTimesheetScroll(selectedWeekStart, {
			scrollTop: scrollContainer.scrollTop,
			topDay,
			offsetWithinDay
		});
	}

	function handleScroll() {
		if (isPanelDestroyed) return;
		cancelAnimationFrame(scrollFrame);
		scrollFrame = requestAnimationFrame(rememberScroll);
	}

	/**
	 * Put the list where it belongs for this week: a day asked for by a save (showTimeEntryDay),
	 * else where the user left this week, else today (when in view), else the top.
	 */
	function positionList(weekStart: string) {
		if (!scrollContainer) return;
		isPositioning = true;
		const focusDay = navigation.takeFocusDay();
		const saved = navigation.getTimesheetScroll(weekStart);
		if (focusDay && daySectionRefs[focusDay]) {
			scrollDayToTop(focusDay, 'auto');
			highlightedDay = focusDay;
			clearTimeout(highlightTimeout);
			highlightTimeout = setTimeout(() => (highlightedDay = null), 2500);
		} else if (saved?.topDay && daySectionRefs[saved.topDay]) {
			const dayElement = daySectionRefs[saved.topDay];
			const offset =
				dayElement.getBoundingClientRect().top -
				scrollContainer.getBoundingClientRect().top +
				scrollContainer.scrollTop;
			scrollContainer.scrollTo({ top: Math.max(0, offset + saved.offsetWithinDay), behavior: 'auto' });
		} else if (saved) {
			scrollContainer.scrollTo({ top: saved.scrollTop, behavior: 'auto' });
		} else if (displayDays.includes(todayString)) {
			scrollDayToTop(todayString, 'auto');
		} else {
			scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
		}
		requestAnimationFrame(() => {
			isPositioning = false;
			positionedWeek = weekStart;
		});
	}

	// Position once per week shown (and again whenever a save asks to show a day)
	$effect(() => {
		const weekStart = selectedWeekStart;
		const focusToken = navigation.focusDayToken;
		if (!selectedWeekData || !scrollContainer) return;
		const key = `${weekStart}|${focusToken}`;
		if (key === positionedFor) return;
		positionedFor = key;
		void tick().then(() => positionList(weekStart));
	});

	// "Load older weeks" appends earlier weeks below the selected one; reset on week change
	let olderWeeksShown = $state(0);
	let olderWeeksShownFor = $state('');

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

	// Every day of the selected week is shown, future days included, so time can be logged ahead
	let displayDays = $derived(getWeekDates(selectedWeekStart));

	// Older weeks appended by "Load older weeks", newest first
	let olderWeekStarts = $derived(
		olderWeeksShownFor === selectedWeekStart
			? Array.from({ length: olderWeeksShown }, (_, offset) => shiftWeek(selectedWeekStart, -(offset + 1)))
			: []
	);

	// The Add Entry modal in the phone footer opens on today when today is in view
	let addEntryDate = $derived(displayDays.includes(todayString) ? todayString : selectedWeekStart);

	let showFooterTimer = $derived(!isSidebarTimerWidgetMounted());

	function formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function shiftWeek(weekStart: string, weekOffset: number): string {
		const shiftedDate = new SvelteDate(weekStart + 'T00:00:00');
		shiftedDate.setDate(shiftedDate.getDate() + weekOffset * 7);
		return formatDate(shiftedDate);
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

	/** Show one more week below the ones on screen (loading it first if needed) */
	async function loadOlderWeek() {
		if (isLoadingOlderWeek) return;
		const shownSoFar = olderWeeksShownFor === selectedWeekStart ? olderWeeksShown : 0;
		const nextOlderWeek = shiftWeek(selectedWeekStart, -(shownSoFar + 1));
		isLoadingOlderWeek = true;
		try {
			await ensureWeekLoaded(nextOlderWeek);
			olderWeeksShownFor = selectedWeekStart;
			olderWeeksShown = shownSoFar + 1;
		} finally {
			isLoadingOlderWeek = false;
		}
	}

	function findWeekData(weekStart: string): WeekData | null {
		return loadedWeeks.find((week) => week.weekStart === weekStart) ?? null;
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

	/** Find the day data for a given date in the selected week */
	function findDayDataForDate(dateString: string) {
		if (!selectedWeekData) return null;
		return selectedWeekData.days.find((day) => day.date === dateString) ?? null;
	}

	// --- Week navigation handlers ---

	function navigateToPrevWeek() {
		const previousWeekStart = shiftWeek(selectedWeekStart, -1);
		navigation.selectWeek(previousWeekStart);
		ensureWeekLoaded(previousWeekStart);
	}

	function navigateToNextWeek() {
		const nextWeekStart = shiftWeek(selectedWeekStart, 1);
		navigation.selectWeek(nextWeekStart);
		ensureWeekLoaded(nextWeekStart);
	}

	function handleDayClick(dateString: string) {
		scrollDayToTop(dateString, 'smooth');
	}

	// When selectedWeek changes externally, ensure that week is loaded
	$effect(() => {
		const weekToLoad = selectedWeekStart;
		ensureWeekLoaded(weekToLoad);
	});

	onMount(() => {
		window.addEventListener(TIME_ENTRY_SAVED_EVENT, handleTimeEntrySaved);
		void loadInitialWeeks();
		return () => {
			isPanelDestroyed = true;
			window.removeEventListener(TIME_ENTRY_SAVED_EVENT, handleTimeEntrySaved);
			cancelAnimationFrame(scrollFrame);
			clearTimeout(highlightTimeout);
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
		class={[
			'mb-3 transition-shadow',
			isToday && 'rounded-lg bg-amber-50/60 p-3',
			highlightedDay === dayDate && 'rounded-lg ring-2 ring-blue-300'
		]
			.filter(Boolean)
			.join(' ')}
		bind:this={daySectionRefs[dayDate]}
		data-day={dayDate}
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
						class="rounded px-1.5 text-sm leading-none text-stone-500 hover:text-blue-500 pointer-coarse:py-1"
						title="Add entry"
						aria-label="Add entry for {formatDayHeader(dayDate)}"
					>
						+
					</button>
				{/if}
			</div>
			{#if totalMinutes > 0}
				<span class="text-sm font-medium tabular-nums text-stone-500">
					{formatMinutes(totalMinutes)}
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

{#snippet olderWeekSection(weekStart: string)}
	{@const weekData = findWeekData(weekStart)}
	{@const daysWithEntries = weekData?.days.filter((day) => day.entries.length > 0) ?? []}
	<section class="mt-6" aria-label="Week {getIsoWeekNumber(weekStart)}">
		<div class="mb-2 flex items-center gap-3">
			<h2 class="text-xs font-semibold tracking-widest whitespace-nowrap text-stone-500 uppercase">
				Week {getIsoWeekNumber(weekStart)} &middot; {formatWeekRange(weekStart)}
			</h2>
			<div class="h-px flex-1 bg-stone-200"></div>
			<span class="text-xs font-medium tabular-nums text-stone-500">
				{formatMinutes(weekData?.weeklyTotalMinutes ?? 0)}
			</span>
		</div>
		{#if !weekData}
			<p class="px-1 text-sm text-stone-400">Loading…</p>
		{:else if daysWithEntries.length === 0}
			<p class="px-1 text-sm italic text-stone-400">No entries this week</p>
		{:else}
			{#each daysWithEntries as day (day.date)}
				{@render daySection(day.date, day.entries, day.totalMinutes)}
			{/each}
		{/if}
	</section>
{/snippet}

<div class="flex h-full flex-col overflow-hidden bg-stone-50">
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

	<!-- Scrollable content: the selected week's seven days, then any older weeks loaded -->
	<div bind:this={scrollContainer} onscroll={handleScroll} class="flex-1 overflow-y-auto px-4 py-4 sm:px-6" data-testid="timesheet-scroll">
		{#if isLoading && loadedWeeks.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-stone-500">Loading weeks...</p>
			</div>
		{:else}
			{#each displayDays as dayDate (dayDate)}
				{@const dayData = findDayDataForDate(dayDate)}
				{@render daySection(dayDate, dayData?.entries ?? [], dayData?.totalMinutes ?? 0)}
			{/each}

			{#each olderWeekStarts as olderWeekStart (olderWeekStart)}
				{@render olderWeekSection(olderWeekStart)}
			{/each}

			<div class="flex justify-center pb-4 pt-4">
				<button
					onclick={loadOlderWeek}
					disabled={isLoadingOlderWeek}
					class="rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
				>
					{isLoadingOlderWeek ? 'Loading…' : 'Show the week before'}
				</button>
			</div>
		{/if}
	</div>

	<!-- Phone: the sidebar (and its timer) is off screen inside the timesheet -->
	{#if showFooterTimer}
		<div class="flex-shrink-0">
			<TimerWidget placement="footer" {addEntryDate} />
		</div>
	{/if}
</div>
