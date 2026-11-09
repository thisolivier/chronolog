<script lang="ts">
	import FindBar from '$lib/components/find/FindBar.svelte';
	import { onMount, tick } from 'svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';
	import WeekStrip from '$lib/components/weekly/WeekStrip.svelte';
	import TimeEntryCard from '$lib/components/weekly/TimeEntryCard.svelte';
	import NewEntryRow from '$lib/components/weekly/NewEntryRow.svelte';
	import TotalTimeModal from '$lib/components/weekly/TotalTimeModal.svelte';
	import { getMondayOfWeek, getWeekDates, formatDayHeader } from '$lib/utils/iso-week';
	import { formatDayHeading, formatWeekHeading } from '$lib/components/weekly/week-labels';
	import { dayJumpScrollTop } from '$lib/components/weekly/day-jump';
	import { formatMinutes } from '$lib/utils/duration';
	import { SvelteDate } from 'svelte/reactivity';
	import { TIME_ENTRY_SAVED_EVENT, readTimeEntrySavedDetail } from '$lib/components/weekly/time-entry-events';
	import { focusSavedEntry } from '$lib/components/weekly/entry-focus';
	import type { WeekData, TimeEntryDisplay } from '$lib/services/types';
	import { OUTBOX_REPLAYED_EVENT } from '$lib/offline/offline-session.svelte';
	import { OUTBOX_RESOLVED_EVENT } from '$lib/offline/outbox-resolve';

	const navigation = getNavigationContext();
	const dataService = getDataService();

	let loadedWeeks = $state<WeekData[]>([]);
	let isLoading = $state(false);
	let isLoadingOlderWeek = $state(false);
	let daySectionRefs: Record<string, HTMLElement> = {};
	let scrollContainer: HTMLElement | undefined = $state();
	/** The week the Total time modal opened from (sprint 065-TT); null while it is closed */
	let totalTimeWeekStart = $state<string | null>(null);

	/**
	 * Scroll the day list so a day's heading sits at the top. Sets scrollTop on the panel's own
	 * scroller instead of calling scrollIntoView, which in Chromium also moves the sequential focus
	 * starting point (the first Tab then landed on today's "+"). The week controls are outside the
	 * scroller; anything pinned inside it is declared as its `scroll-padding-top` (057-DR, TR-01).
	 */
	function scrollDayToTop(dateString: string, behavior: 'auto' | 'smooth') {
		const dayElement = daySectionRefs[dateString];
		if (!dayElement || !scrollContainer) return;
		const top = dayJumpScrollTop({
			dayTop: dayElement.getBoundingClientRect().top,
			scrollerTop: scrollContainer.getBoundingClientRect().top,
			scrollTop: scrollContainer.scrollTop,
			stickyInsetPixels: Number.parseFloat(getComputedStyle(scrollContainer).scrollPaddingTop) || 0
		});
		scrollContainer.scrollTo({ top, behavior });
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

	// Phone (TR-08; owner change in 060-DR): no footer timer bar and no Start timer / Add Entry in
	// the week controls. A running or stopped capture is in the header pill (053-DR); a new timer
	// starts from the home screen's widget; each day heading keeps its "Add entry".

	// A failed week-status save, shown at the status (TR-07); cleared by the next attempt
	let statusError = $state('');

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

	/** Recordkeeping only: the week's status changes and nothing is sent (TR-07) */
	async function handleStatusChange(weekStart: string, newStatus: string) {
		// The week is sent as its Monday, the server's key; no week number (061-DR)
		statusError = '';
		try {
			await dataService.updateWeeklyStatus(weekStart, newStatus);

			const weekIndex = loadedWeeks.findIndex((week) => week.weekStart === weekStart);
			if (weekIndex !== -1) {
				loadedWeeks[weekIndex].status = newStatus;
			}
		} catch (error) {
			console.error('Error updating status:', error);
			statusError = `Couldn't save “${newStatus}”. Try again.`;
		}
	}

	function toggleAddEntry(dateKey: string) {
		expandedAddEntry[dateKey] = !expandedAddEntry[dateKey];
	}

	/**
	 * Focus after a save (A-11): the saved entry's card once the refreshed list renders it,
	 * otherwise that day's "+". Only when focus was lost (on <body>) or is still inside the
	 * timesheet, so a save never pulls focus out of a field the user has moved to.
	 */
	async function focusAfterSave(entryId: string | null | undefined, date: string) {
		await tick();
		const activeElement = document.activeElement;
		const focusIsFree =
			!activeElement || activeElement === document.body || Boolean(scrollContainer?.contains(activeElement));
		if (focusIsFree && scrollContainer) focusSavedEntry(scrollContainer, entryId, date);
	}

	async function handleEntryCreated(dateKey: string, entryId: string) {
		expandedAddEntry[dateKey] = false;
		await refreshWeeks();
		await focusAfterSave(entryId, dateKey);
	}

	/** The new-entry row was cancelled: focus goes back to the day's "+" that opened it */
	async function handleAddEntryCancelled(dateKey: string) {
		toggleAddEntry(dateKey);
		await focusAfterSave(undefined, dateKey);
	}

	/** An entry was saved by the timer widget or the Add Entry modal (sidebar) */
	async function handleTimeEntrySaved(event: Event) {
		const { entryId, date } = readTimeEntrySavedDetail(event);
		await refreshWeeks();
		if (date) {
			await ensureWeekLoaded(getMondayOfWeek(date));
			await focusAfterSave(entryId, date);
		}
	}

	/** A [[noteId]] link in a card was clicked: switch to notes mode and open that note */
	/** Open a note from a card: a followed link, or a note just attached ('new-note', 049-UI) */
	async function openNoteFromEntry(noteId: string, focusEditor: true | 'new-note') {
		try {
			const note = await dataService.getNoteById(noteId);
			// The sidebar's directory includes archived contracts (033); the selectable list does not
			const clientId =
				contractDirectory.labels[note.contractId]?.clientId ??
				(await dataService.getContracts()).find((contract) => contract.id === note.contractId)?.clientId ??
				'';
			navigation.openNote(noteId, note.contractId, clientId, { focusEditor });
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

	// A status error belongs to the week it was made on
	$effect(() => {
		void selectedWeekStart;
		statusError = '';
	});

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

	// Offline changes reached the server or a held one was resolved: show the server's weeks
	const handleOutboxChange = () => void refreshWeeks();

	onMount(() => {
		window.addEventListener(TIME_ENTRY_SAVED_EVENT, handleTimeEntrySaved);
		window.addEventListener(OUTBOX_REPLAYED_EVENT, handleOutboxChange);
		window.addEventListener(OUTBOX_RESOLVED_EVENT, handleOutboxChange);
		void loadInitialWeeks();
		return () => {
			isPanelDestroyed = true;
			window.removeEventListener(TIME_ENTRY_SAVED_EVENT, handleTimeEntrySaved);
			window.removeEventListener(OUTBOX_REPLAYED_EVENT, handleOutboxChange);
			window.removeEventListener(OUTBOX_RESOLVED_EVENT, handleOutboxChange);
			cancelAnimationFrame(scrollFrame);
			clearTimeout(highlightTimeout);
		};
	});
</script>

<!--
	Day section (057-DR, TR-02): a bark-brown heading bar (date, local Add entry, day total) that
	sticks to the top of the scroller while the day's entries scroll and is replaced by the next
	day's heading at the boundary (sticky inside its own section). Square ends. Today carries an
	ochre marker at the bar's left edge, with no tint across the day. Entries keep their
	chronological order. Since 064-DR the bar runs edge to edge of the scroller (it cancels the
	scroller's gutter) while its text keeps its place, and the day total's right edge lines up with
	the entries' durations at both card widths (the section is the size container for that).
-->
{#snippet daySection(dayDate: string, entries: TimeEntryDisplay[], totalMinutes: number)}
	{@const isToday = dayDate === todayString}
	{@const isQuiet = entries.length === 0 && !isToday}
	<section
		class={['@container mb-4 transition-shadow', highlightedDay === dayDate && 'ring-2 ring-pine-300']}
		bind:this={daySectionRefs[dayDate]}
		data-day={dayDate}
		aria-label={formatDayHeader(dayDate)}
	>
		<div
			class={['day-heading flex min-h-9 items-center gap-3 py-1', isQuiet ? 'bg-bark-100 text-bark-800' : 'bg-bark-600 text-on-accent']}
			data-testid="day-heading"
			data-today={isToday ? 'true' : undefined}
		>
			{#if isToday}
				<span class="absolute inset-y-0 left-0 w-[4px] bg-ochre-300" aria-hidden="true" data-testid="today-marker"></span>
			{/if}
			<!-- Today: 4 px further in, where the marker used to push it -->
			<h2 class={['min-w-0 text-sm font-semibold whitespace-nowrap sm:text-base', isToday && 'ml-[4px]']}>
				<span class="hidden sm:inline">{formatDayHeading(dayDate)}</span>
				<span class="sm:hidden">{formatDayHeading(dayDate, 'short')}</span>
			</h2>
			{#if isToday}
				<span class="rounded-sm bg-ochre-300 px-1.5 py-px text-[11px] font-bold tracking-wide text-ochre-900 uppercase">Today</span>
			{/if}
			{#if !expandedAddEntry[dayDate]}
				<span class="h-4 border-l {isQuiet ? 'border-bark-300' : 'border-bark-400'}" aria-hidden="true"></span>
				<button
					onclick={() => toggleAddEntry(dayDate)}
					data-add-entry={dayDate}
					class={[
						'flex items-center gap-1 rounded-control px-1.5 py-0.5 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none pointer-coarse:min-h-11 pointer-coarse:min-w-11',
						isQuiet ? 'text-bark-700 hover:bg-bark-200 focus-visible:ring-bark-600' : 'text-bark-50 hover:bg-bark-500 focus-visible:ring-ochre-300'
					]}
					title="Add entry"
					aria-label="Add entry for {formatDayHeader(dayDate)}"
				>
					<span aria-hidden="true" class="text-base leading-none">+</span>
					<!-- Under 360 px (320-wide phones) only the + shows; the label crowded the date and total -->
					<span class="max-[359px]:sr-only">Add entry</span>
				</button>
			{/if}
			<span class="ml-auto text-sm font-semibold whitespace-nowrap tabular-nums sm:text-base" data-testid="day-total">
				{totalMinutes > 0 ? formatMinutes(totalMinutes) : ''}
			</span>
		</div>

		{#if expandedAddEntry[dayDate]}
			<div class="mt-2">
				<NewEntryRow
					date={dayDate}
					onEntryCreated={(entryId) => handleEntryCreated(dayDate, entryId)}
					onCancel={() => handleAddEntryCancelled(dayDate)}
				/>
			</div>
		{/if}

		{#if entries.length > 0}
			<!-- @container: the rows reflow on the panel's width, not the window's -->
			<div class="@container flex flex-col">
				{#each entries as entry (entry.id)}
					<TimeEntryCard
						{entry}
						onUpdated={refreshWeeks}
						onNoteLinkClick={(noteId) => openNoteFromEntry(noteId, true)}
						onNoteAttached={(noteId) => openNoteFromEntry(noteId, 'new-note')}
					/>
				{/each}
			</div>
		{:else if !expandedAddEntry[dayDate]}
			<p class="px-3 py-2 text-sm text-ink-faint italic">No entries</p>
		{/if}
	</section>
{/snippet}

{#snippet olderWeekSection(weekStart: string)}
	{@const weekData = findWeekData(weekStart)}
	{@const daysWithEntries = weekData?.days.filter((day) => day.entries.length > 0) ?? []}
	<section class="mt-6" aria-label={formatWeekHeading(weekStart)}>
		<div class="mb-2 flex items-center gap-3">
			<h2 class="text-xs font-semibold tracking-widest whitespace-nowrap text-ink-faint uppercase">
				{formatWeekHeading(weekStart)}
			</h2>
			<div class="h-px flex-1 bg-chalk-200"></div>
			<button
				type="button"
				onclick={() => (totalTimeWeekStart = weekStart)}
				class="rounded-control px-1 text-xs font-medium tabular-nums text-ink-faint btn-quiet"
				title="Total time"
				data-testid="older-week-total"
			>
				{formatMinutes(weekData?.weeklyTotalMinutes ?? 0)}
			</button>
		</div>
		{#if !weekData}
			<p class="px-1 text-sm text-ink-faint">Loading…</p>
		{:else if daysWithEntries.length === 0}
			<p class="px-1 text-sm italic text-ink-faint">No entries this week</p>
		{:else}
			{#each daysWithEntries as day (day.date)}
				{@render daySection(day.date, day.entries, day.totalMinutes)}
			{/each}
		{/if}
	</section>
{/snippet}


<div class="flex h-full flex-col overflow-hidden bg-surface">
	<FindBar mode="dom" />
	<!-- WeekStrip: sticky at the top of the panel (a zeroed shell while the week loads) -->
	{#if selectedWeekData || !isLoading}
		<WeekStrip
			weekStart={selectedWeekStart}
			days={weekStripDays}
			weeklyTotalMinutes={selectedWeekData?.weeklyTotalMinutes ?? 0}
			currentStatus={selectedWeekData?.status ?? 'Unsubmitted'}
			{statusError}
			onStatusChange={(newStatus) => handleStatusChange(selectedWeekStart, newStatus)}
			onPrevWeek={navigateToPrevWeek}
			onNextWeek={navigateToNextWeek}
			onDayClick={handleDayClick}
			onToday={() => navigation.showTimeEntryDay(todayString)}
			onTotalClick={() => (totalTimeWeekStart = selectedWeekStart)}
		/>
	{/if}

	{#if totalTimeWeekStart}
		<TotalTimeModal weekStart={totalTimeWeekStart} onClose={() => (totalTimeWeekStart = null)} />
	{/if}

	<!-- Scrollable content: the selected week's seven days, then any older weeks loaded -->
	<div bind:this={scrollContainer} onscroll={handleScroll} class="timesheet-scroll flex-1 overflow-y-auto pb-4" data-testid="timesheet-scroll">
		{#if isLoading && loadedWeeks.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-ink-faint">Loading weeks...</p>
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
					class="rounded px-2 py-1 text-sm btn-quiet disabled:opacity-50"
				>
					{isLoadingOlderWeek ? 'Loading…' : 'Show the week before'}
				</button>
			</div>
		{/if}
	</div>
</div>


<style>
	/* Sticky inside its own day section: pinned to the top of the scroller while the day's entries
	   scroll, pushed out by the section's end so the next day's heading takes over. Square ends. */
	.day-heading {
		position: sticky;
		top: 0;
		z-index: 2;
		border-radius: 0;
	}

	/* The scroller's side gutter, as a variable so the day heading can cancel it (064-DR, T1) */
	.timesheet-scroll {
		--timesheet-gutter: 0.75rem;
		padding-inline: var(--timesheet-gutter);
		/* Its own stacking context: the sticky day headings carry a z-index, and without this they
		   would escape to the panel's stacking context and paint over the scroller's overlay
		   scrollbar now that the bar reaches the edge (owner, 2026-11-09). The scrollbar stays on top. */
		isolation: isolate;
	}
	@media (min-width: 40rem) {
		.timesheet-scroll {
			--timesheet-gutter: 1.5rem;
		}
	}

	/* Edge to edge (T1): the bar reaches both sides of the scroller; its left padding keeps the date
	   over the entries' 0.75rem row inset. Its right padding (T2) puts the day total's right edge on
	   the entries' durations: the row's right edge in the narrow card (its actions sit before the
	   time); in the wide card, past the one-button actions column and the column gap (TimeEntryCard). */
	.day-heading {
		margin-inline: calc(-1 * var(--timesheet-gutter));
		padding-left: calc(var(--timesheet-gutter) + 0.75rem);
		padding-right: var(--timesheet-gutter);
	}
	@container (min-width: 36rem) {
		.day-heading {
			padding-right: calc(var(--timesheet-gutter) + var(--size-entry-action) + var(--spacing-entry-column-gap));
		}
	}
</style>
