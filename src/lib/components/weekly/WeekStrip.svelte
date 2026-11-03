<script lang="ts">
	import { getIsoWeekNumber, formatWeekRange } from '$lib/utils/iso-week';
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
		onDayClick
	}: {
		weekStart: string;
		days: DayData[];
		weeklyTotalMinutes: number;
		currentStatus: string;
		onStatusChange: (newStatus: string) => void;
		onPrevWeek: () => void;
		onNextWeek: () => void;
		onDayClick: (date: string) => void;
	} = $props();

	const DAY_ABBREVIATIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const STATUS_CYCLE = ['Unsubmitted', 'Draft ready', 'Submitted'];

	const weekNumber = $derived(getIsoWeekNumber(weekStart));
	const prevWeekNumber = $derived(weekNumber > 1 ? weekNumber - 1 : 52);
	const nextWeekNumber = $derived(weekNumber < 52 ? weekNumber + 1 : 1);

	const todayDateString = $derived(formatTodayDate());

	const weeklyTotalHours = $derived(formatHoursCompact(weeklyTotalMinutes));

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

	function formatDayHours(totalMinutes: number): string {
		if (totalMinutes === 0) return '--';
		const hours = Math.round((totalMinutes / 60) * 10) / 10;
		return `${hours}h`;
	}

	function formatHoursCompact(totalMinutes: number): string {
		const hours = Math.round((totalMinutes / 60) * 10) / 10;
		return `${hours} hrs`;
	}

	function getStatusClasses(status: string): string {
		switch (status) {
			case 'Draft ready':
				return 'bg-amber-100 text-amber-800';
			case 'Submitted':
				return 'bg-emerald-100 text-emerald-800';
			default:
				return 'bg-stone-100 text-stone-600';
		}
	}

	function cycleStatus(): void {
		const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
		const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
		onStatusChange(STATUS_CYCLE[nextIndex]);
	}
</script>

<div class="sticky top-0 z-10 border-b border-stone-200 bg-white">
	<!-- Week navigation row -->
	<div class="flex items-center justify-between px-4 py-1.5">
		<div class="flex items-center gap-1.5">
			<button
				onclick={onPrevWeek}
				class="rounded px-1.5 py-0.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700"
				aria-label="Previous week"
			>&#9664; Week {prevWeekNumber}</button>
			<span class="text-sm font-medium text-stone-700">
				Week {weekNumber} &middot; {formatWeekRange(weekStart)}
			</span>
		</div>
		<button
			onclick={onNextWeek}
			class="rounded px-1.5 py-0.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700"
			aria-label="Next week"
		>Week {nextWeekNumber} &#9654;</button>
	</div>

	<!-- Day columns + summary -->
	<div class="flex px-4 pb-2">
		<!-- 7 day columns -->
		<div class="grid flex-1 grid-cols-7 gap-px">
			{#each days as dayData, dayIndex (dayData.date)}
				{@const isToday = dayData.date === todayDateString}
				{@const colorSegments = computeColorSegments(dayData.entries)}
				<button
					onclick={() => onDayClick(dayData.date)}
					class="flex flex-col items-center rounded px-1 py-1.5 transition-colors
						{isToday ? 'bg-amber-100 border-b-2 border-amber-400 hover:bg-amber-50' : 'hover:bg-stone-50'}
						cursor-pointer"
				>
					<span class="text-xs text-stone-500">{DAY_ABBREVIATIONS[dayIndex]}</span>
					<span class="text-sm font-medium text-stone-800">{getDayNumber(dayData.date)}</span>
					<span class="text-xs tabular-nums text-stone-400">{formatDayHours(dayData.totalMinutes)}</span>
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
		<div class="ml-4 flex w-32 flex-col items-end justify-center gap-1.5">
			<span class="text-base font-semibold tabular-nums text-stone-800">{weeklyTotalHours}</span>
			<button
				onclick={cycleStatus}
				class="rounded-full px-2.5 py-0.5 text-xs font-medium {getStatusClasses(currentStatus)}"
			>
				{currentStatus}
			</button>
		</div>
	</div>
</div>
