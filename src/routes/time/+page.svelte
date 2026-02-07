<script lang="ts">
	import { goto } from '$app/navigation';
	import TimeEntryRow from '$lib/components/time/TimeEntryRow.svelte';

	let { data, form } = $props();

	const initialDate = data.selectedDate;
	let selectedDate = $state(initialDate);

	function formatDuration(totalMinutes: number): string {
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	}

	function formatDateHeading(dateString: string): string {
		const date = new Date(dateString + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function handleDateChange() {
		goto(`/time?date=${selectedDate}`, { replaceState: true });
	}

	function navigateDay(offset: number) {
		const currentDate = new Date(selectedDate + 'T00:00:00');
		currentDate.setDate(currentDate.getDate() + offset);
		selectedDate = currentDate.toISOString().split('T')[0];
		goto(`/time?date=${selectedDate}`, { replaceState: true });
	}
</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b border-gray-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
			<div class="flex items-center gap-4">
				<a href="/" class="text-xl font-bold text-gray-900">Chronolog</a>
				<span class="text-gray-400">/</span>
				<span class="text-sm font-medium text-gray-600">Time Entries</span>
			</div>
			<div class="flex items-center gap-2">
				<a
					href="/time/new"
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
				>
					Add Entry
				</a>
				<a
					href="/"
					class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Dashboard
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl p-6">
		{#if form?.error}
			<div class="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
				{form.error}
			</div>
		{/if}

		{#if form?.success}
			<div class="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
				Entry deleted successfully.
			</div>
		{/if}

		<!-- Date Navigation -->
		<div class="mb-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<button
					onclick={() => navigateDay(-1)}
					class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Previous
				</button>
				<input
					type="date"
					bind:value={selectedDate}
					onchange={handleDateChange}
					class="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
				<button
					onclick={() => navigateDay(1)}
					class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Next
				</button>
				<button
					onclick={() => {
						selectedDate = new Date().toISOString().split('T')[0];
						goto(`/time?date=${selectedDate}`, { replaceState: true });
					}}
					class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Today
				</button>
			</div>

			<div class="text-sm text-gray-600">
				Total: <span class="font-semibold">{formatDuration(data.totalMinutes)}</span>
			</div>
		</div>

		<!-- Date Heading -->
		<h2 class="mb-4 text-lg font-semibold text-gray-900">
			{formatDateHeading(data.selectedDate)}
		</h2>

		<!-- Entries List -->
		{#if data.entries.length === 0}
			<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
				<p class="text-gray-500">No time entries for this date.</p>
				<a
					href="/time/new?date={data.selectedDate}"
					class="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
				>
					Add an entry
				</a>
			</div>
		{:else}
			<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
				{#each data.entries as entry (entry.id)}
					<TimeEntryRow {entry} />
				{/each}
			</div>
		{/if}
	</main>
</div>
