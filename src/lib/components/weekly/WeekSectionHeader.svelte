<script lang="ts">
	import { formatWeekStartLabel, formatHoursFromMinutes } from '$lib/utils/iso-week';

	let {
		weekStart,
		weeklyTotalMinutes,
		currentStatus,
		onStatusChange
	}: {
		weekStart: string;
		weeklyTotalMinutes: number;
		currentStatus: string;
		onStatusChange: (newStatus: string) => void;
	} = $props();

	// eslint-disable-next-line svelte/prefer-writable-derived -- intentionally writable: user types override prop value
	let statusInputValue = $state(currentStatus);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Sync external status changes into local state (also handles initial value)
	$effect(() => {
		statusInputValue = currentStatus;
	});

	function handleStatusBlur() {
		clearTimeout(debounceTimer);
		const trimmedValue = statusInputValue.trim();
		if (trimmedValue !== currentStatus) {
			onStatusChange(trimmedValue);
		}
	}

	function handleStatusInput(event: Event) {
		const input = event.target as HTMLInputElement;
		statusInputValue = input.value;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const trimmedValue = statusInputValue.trim();
			if (trimmedValue !== currentStatus) {
				onStatusChange(trimmedValue);
			}
		}, 1000);
	}
</script>

<div class="mb-3 mt-6 first:mt-0">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-bold text-gray-900">
			{formatWeekStartLabel(weekStart)}
		</h1>
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium text-gray-500">
				{formatHoursFromMinutes(weeklyTotalMinutes)}
			</span>
			<span class="text-gray-300">&middot;</span>
			<input
				type="text"
				value={statusInputValue}
				oninput={handleStatusInput}
				onblur={handleStatusBlur}
				placeholder="Status..."
				class="w-36 border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-right text-sm text-gray-500 placeholder-gray-400 focus:border-gray-300 focus:ring-0 focus:outline-none"
			/>
		</div>
	</div>
</div>
