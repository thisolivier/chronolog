<!--
	Week overview (design r1 TR-01, sprint 057-DR): week navigation, Today, week total and status on
	one row; seven day cells (weekday and date on one line, duration below, a thin segmented bar of
	the day's client colours from the actual entries). A day cell scrolls to that day's heading; it
	is not a filter. Week numbers follow calendar-week.ts (Week 1 contains 1 January).
	Phone: the total and status move to their own row, with `phoneActions` (capture access when no
	timer runs) beside them.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getMondayOfWeek } from '$lib/utils/iso-week';
	import { calendarWeekNumber } from '$lib/utils/calendar-week';
	import { formatMinutes, formatMinutesCompact } from '$lib/utils/duration';
	import WeekStatusMenu from './WeekStatusMenu.svelte';
	import { computeColorSegments, type WeekStripDayEntry as DayEntry } from './week-strip-segments';
	import { formatStripDay, formatWeekSpan, neighbourWeekNumbers } from './week-labels';

	type DayData = {
		date: string;
		totalMinutes: number;
		entries: DayEntry[];
	};

	let {
		weekStart,
		days,
		weeklyTotalMinutes,
		currentStatus,
		statusError = '',
		onStatusChange,
		onPrevWeek,
		onNextWeek,
		onDayClick,
		onToday,
		phoneActions
	}: {
		weekStart: string;
		days: DayData[];
		weeklyTotalMinutes: number;
		currentStatus: string;
		/** A failed status save, shown under the status until the next attempt */
		statusError?: string;
		onStatusChange: (newStatus: string) => void;
		onPrevWeek: () => void;
		onNextWeek: () => void;
		onDayClick: (date: string) => void;
		/** Jump to the current week and today's section (sprint 041-CL); no button without it */
		onToday?: () => void;
		/** Extra phone-only controls in the total / status row */
		phoneActions?: Snippet;
	} = $props();

	const weekNumber = $derived(calendarWeekNumber(weekStart));
	const neighbours = $derived(neighbourWeekNumbers(weekStart));

	const todayDateString = $derived(formatTodayDate());
	const isCurrentWeek = $derived(weekStart === getMondayOfWeek(todayDateString));

	const weeklyTotalHours = $derived(formatMinutes(weeklyTotalMinutes));

	function formatTodayDate(): string {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	}

	/** Day cell: compact h/m, an en dash for a day with nothing logged */
	function formatDayHours(totalMinutes: number): string {
		return totalMinutes === 0 ? '–' : formatMinutesCompact(totalMinutes);
	}
</script>

<!-- On a short landscape phone screen the strip scrolls away, so the entries get the height (047-QA) -->
<div class="week-strip sticky top-0 z-10 border-b border-divider bg-surface [@media(max-height:500px)]:static" data-testid="week-strip">
	<!-- Navigation · Today ········ total · status (phone: total and status below the days) -->
	<div class="week-strip-nav flex min-w-0 items-center gap-2 px-2 pt-2 pb-1 sm:px-4">
		<button
			onclick={onPrevWeek}
			class="flex items-center rounded-control px-1.5 py-1 text-sm btn-quiet pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
			aria-label="Previous week"
			title="Week {neighbours.previous}"
		>&#8249;<span class="ml-1 hidden text-xs lg:inline">Week {neighbours.previous}</span></button>
		<h2 class="min-w-0 text-sm font-semibold whitespace-nowrap text-ink sm:text-base" data-testid="week-heading">
			Week {weekNumber} <span class="font-normal text-ink-muted">&middot; {formatWeekSpan(weekStart)}</span>
		</h2>
		<button
			onclick={onNextWeek}
			class="flex items-center rounded-control px-1.5 py-1 text-sm btn-quiet pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
			aria-label="Next week"
			title="Week {neighbours.next}"
		><span class="mr-1 hidden text-xs lg:inline">Week {neighbours.next}</span>&#8250;</button>
		{#if onToday}
			<button
				onclick={onToday}
				disabled={isCurrentWeek}
				title={isCurrentWeek ? 'Already on this week' : 'Go to today'}
				class="ml-auto rounded-control border border-line px-2.5 py-0.5 text-xs font-medium btn-quiet pointer-coarse:py-2 disabled:cursor-default disabled:border-divider disabled:text-ink-fainter disabled:hover:bg-transparent sm:ml-1"
				data-testid="week-today-button"
			>Today</button>
		{/if}
	</div>

	<div class="week-strip-summary flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 pb-2 sm:justify-end sm:px-4 sm:pt-2 sm:pb-1">
		<span class="text-base font-semibold whitespace-nowrap tabular-nums text-ink sm:text-lg" data-testid="week-total">{weeklyTotalHours}</span>
		<div class="flex flex-col items-end">
			<WeekStatusMenu {currentStatus} {onStatusChange} />
			{#if statusError}
				<p class="mt-0.5 text-xs text-danger" role="alert" data-testid="week-status-error">{statusError}</p>
			{/if}
		</div>
		{#if phoneActions}
			<div class="flex basis-full justify-end gap-2 empty:hidden sm:order-first sm:basis-auto">{@render phoneActions()}</div>
		{/if}
	</div>

	<!-- Seven days: a jump to that day's heading, not a filter -->
	<div class="week-strip-days grid grid-cols-7 px-1 pb-2 sm:px-3">
		{#each days as dayData, dayIndex (dayData.date)}
			{@const isToday = dayData.date === todayDateString}
			{@const colorSegments = computeColorSegments(dayData.entries)}
			<button
				onclick={() => onDayClick(dayData.date)}
				aria-label="Go to {dayData.date}"
				class={[
					'flex min-w-0 cursor-pointer flex-col items-center rounded-control px-0.5 pt-1 pb-1.5 transition-colors',
					dayIndex > 0 && 'day-cell-divider',
					isToday ? 'bg-ochre-100 hover:bg-ochre-50' : 'hover:bg-sunken'
				]}
				data-testid="week-strip-day"
				data-today={isToday ? 'true' : undefined}
			>
				<span class="flex flex-wrap justify-center gap-x-1 text-xs leading-tight sm:text-sm {isToday ? 'font-bold text-ink' : 'font-semibold text-ink-soft'}">
					{#each formatStripDay(dayData.date).split(' ') as word, wordIndex (wordIndex)}<span>{word}</span>{/each}
				</span>
				<span class="text-[11px] whitespace-nowrap tabular-nums text-ink-muted sm:text-xs">{formatDayHours(dayData.totalMinutes)}</span>
				<!-- Client-colour breakdown of the day's minutes (actual entries) -->
				<span class="mt-1 flex h-1 w-full max-w-24 gap-px" aria-hidden="true" data-testid="week-strip-bar">
					{#each colorSegments as segment (segment.clientId)}
						<!-- flex-grow by share, so the 1px gaps never push the bar past 100% -->
						<span class="{segment.colorClass} h-full min-w-0.5 basis-0" style="flex-grow: {segment.percentage}" data-share={segment.percentage.toFixed(1)}></span>
					{/each}
				</span>
			</button>
		{/each}
	</div>

</div>

<style>
	/* One instance of each control; the grid moves total and status under the days on a phone */
	.week-strip {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'nav' 'days' 'summary';
	}
	.week-strip-nav {
		grid-area: nav;
	}
	.week-strip-days {
		grid-area: days;
	}
	.week-strip-summary {
		grid-area: summary;
	}
	@media (min-width: 40rem) {
		.week-strip {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'nav summary' 'days days';
		}
	}
	/* Thin dividers between the day cells, open at both ends */
	.day-cell-divider {
		position: relative;
	}
	.day-cell-divider::before {
		content: '';
		position: absolute;
		left: 0;
		top: 20%;
		bottom: 20%;
		border-left: 1px solid var(--color-divider);
	}
</style>
