<script lang="ts">
	import { formatWeekStartShort, formatHoursFromMinutes } from '$lib/utils/iso-week';

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
	<h1 class="text-lg font-bold text-gray-900">
		{formatWeekStartShort(weekStart)}
		<span class="font-semibold text-gray-600">
			&middot; {formatHoursFromMinutes(weeklyTotalMinutes)}
		</span>
	</h1>
	<input
		type="text"
		value={statusInputValue}
		oninput={handleStatusInput}
		onblur={handleStatusBlur}
		placeholder="Status..."
		class="mt-1 w-48 border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-sm text-gray-500 placeholder-gray-400 focus:border-gray-300 focus:ring-0 focus:outline-none"
	/>
</div>
