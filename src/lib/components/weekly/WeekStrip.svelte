<script lang="ts">
	import { getIsoWeekNumber, formatWeekRange, getMondayOfWeek } from '$lib/utils/iso-week';
	import { formatMinutes, formatMinutesCompact } from '$lib/utils/duration';
	import WeekStatusMenu from './WeekStatusMenu.svelte';
	import {
		computeColorSegments,
		type WeekStripDayEntry as DayEntry
	} from './week-strip-segments';

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
		onStatusChange,
		onPrevWeek,
		onNextWeek,
		onDayClick,
		onToday
	}: {
		weekStart: string;
		days: DayData[];
		weeklyTotalMinutes: number;
		currentStatus: string;
		onStatusChange: (newStatus: string) => void;
		onPrevWeek: () => void;
		onNextWeek: () => void;
		onDayClick: (date: string) => void;
		/** Jump to the current week and today's section (sprint 041-CL); no button without it */
		onToday?: () => void;
	} = $props();

	const DAY_ABBREVIATIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const weekNumber = $derived(getIsoWeekNumber(weekStart));
	const prevWeekNumber = $derived(weekNumber > 1 ? weekNumber - 1 : 52);
	const nextWeekNumber = $derived(weekNumber < 52 ? weekNumber + 1 : 1);

	const todayDateString = $derived(formatTodayDate());
	const isCurrentWeek = $derived(weekStart === getMondayOfWeek(todayDateString));

	const weeklyTotalHours = $derived(formatMinutes(weeklyTotalMinutes));

	function formatTodayDate(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function getDayNumber(dateString: string): number {
		return new Date(dateString + 'T00:00:00').getDate();
	}

	/** Day cell: compact h/m, an en dash for a day with nothing logged */
	function formatDayHours(totalMinutes: number): string {
		return totalMinutes === 0 ? '–' : formatMinutesCompact(totalMinutes);
	}
</script>

<!-- On a short landscape phone screen the strip scrolls away, so the entries get the height (047-QA) -->
<div class="sticky top-0 z-10 border-b border-stone-200 bg-white [@media(max-height:500px)]:static">
	<!-- Week navigation row -->
	<div class="flex items-center justify-between px-2 py-1.5 sm:px-4">
		<div class="flex items-center gap-1.5">
			<button
				onclick={onPrevWeek}
				class="rounded px-1.5 py-0.5 text-sm btn-quiet pointer-coarse:min-h-11 pointer-coarse:min-w-11"
				aria-label="Previous week"
			>&#9664;<span class="ml-1 hidden sm:inline">Week {prevWeekNumber}</span></button>
			<span class="text-sm font-medium text-stone-700">
				Week {weekNumber} &middot; {formatWeekRange(weekStart)}
			</span>
		</div>
		<div class="flex items-center gap-1.5">
			{#if onToday}
				<button
					onclick={onToday}
					disabled={isCurrentWeek}
					title={isCurrentWeek ? 'Already on this week' : 'Go to today'}
					class="rounded border border-stone-300 px-2 py-0.5 text-xs font-medium pointer-coarse:py-2 btn-quiet disabled:cursor-default disabled:border-stone-200 disabled:text-stone-300 disabled:hover:bg-transparent"
					data-testid="week-today-button"
				>Today</button>
			{/if}
			<button
				onclick={onNextWeek}
				class="rounded px-1.5 py-0.5 text-sm btn-quiet pointer-coarse:min-h-11 pointer-coarse:min-w-11"
				aria-label="Next week"
			><span class="mr-1 hidden sm:inline">Week {nextWeekNumber}</span>&#9654;</button>
		</div>
	</div>

	<!-- Day columns + summary -->
	<div class="flex px-2 pb-2 sm:px-4">
		<!-- 7 day columns -->
		<div class="grid flex-1 grid-cols-7 gap-px">
			{#each days as dayData, dayIndex (dayData.date)}
				{@const isToday = dayData.date === todayDateString}
				{@const colorSegments = computeColorSegments(dayData.entries)}
				<button
					onclick={() => onDayClick(dayData.date)}
					aria-label="Go to {dayData.date}"
					class="flex min-w-0 flex-col items-center rounded px-0.5 py-1.5 transition-colors
						{isToday ? 'bg-amber-100 border-b-2 border-amber-400 hover:bg-amber-50' : 'hover:bg-stone-50'}
						cursor-pointer"
				>
					<span class="text-xs text-stone-500">{DAY_ABBREVIATIONS[dayIndex]}</span>
					<span class="text-sm font-medium text-stone-800">{getDayNumber(dayData.date)}</span>
					<span class="text-[11px] whitespace-nowrap tabular-nums text-stone-400 sm:text-xs">{formatDayHours(dayData.totalMinutes)}</span>
					<!-- Color proportion bar -->
					<div class="mt-1 flex h-1.5 w-full overflow-hidden rounded-full">
						{#each colorSegments as segment (segment.clientId)}
							<div
								class="{segment.colorClass} h-full"
								style="width: {segment.percentage}%"
							></div>
						{/each}
					</div>
				</button>
			{/each}
		</div>

		<!-- Week summary area -->
		<div class="ml-2 flex w-24 shrink-0 flex-col items-end justify-center gap-1.5 sm:ml-4 sm:w-32">
			<span class="text-base font-semibold whitespace-nowrap tabular-nums text-stone-800">{weeklyTotalHours}</span>
			<WeekStatusMenu {currentStatus} {onStatusChange} />
		</div>
	</div>
</div>
