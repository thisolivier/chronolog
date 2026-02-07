<script lang="ts">
	import { enhance } from '$app/forms';
	import CascadingSelects from '$lib/components/timer/CascadingSelects.svelte';

	let { data, form } = $props();

	const isEditing = $derived(!!data.existingEntry);

	// Extract initial values from server data (intentionally captured once for form defaults)
	const initialEntry = data.existingEntry;
	const initialDate = initialEntry?.date || data.defaultDate;

	let selectedDate = $state(initialDate);
	let startTime = $state(initialEntry?.startTime?.substring(0, 5) || '');
	let endTime = $state(initialEntry?.endTime?.substring(0, 5) || '');
	let manualDuration = $state('');
	let description = $state(initialEntry?.description || '');

	let selectedContractId = $state(initialEntry?.contractId || '');
	let selectedDeliverableId = $state(initialEntry?.deliverableId || '');
	let selectedWorkTypeId = $state(initialEntry?.workTypeId || '');

	let useDurationInput = $state(false);

	function formatExistingDuration(): string {
		if (!data.existingEntry) return '';
		const totalMinutes = data.existingEntry.durationMinutes;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	}

	// If editing and there's no start/end time, use duration input mode
	$effect(() => {
		if (data.existingEntry && !data.existingEntry.startTime) {
			useDurationInput = true;
			manualDuration = formatExistingDuration();
		}
	});
</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b border-gray-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
			<div class="flex items-center gap-4">
				<a href="/" class="text-xl font-bold text-gray-900">Chronolog</a>
				<span class="text-gray-400">/</span>
				<a href="/" class="text-sm font-medium text-gray-600 hover:text-gray-900">
					Time Entries
				</a>
				<span class="text-gray-400">/</span>
				<span class="text-sm font-medium text-gray-600">
					{isEditing ? 'Edit Entry' : 'New Entry'}
				</span>
			</div>
			<a
				href="/"
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
			>
				Cancel
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-3xl p-6">
		{#if form?.error}
			<div class="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
				{form.error}
			</div>
		{/if}

		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h1 class="mb-6 text-lg font-semibold text-gray-900">
				{isEditing ? 'Edit Time Entry' : 'New Time Entry'}
			</h1>

			<form method="POST" use:enhance class="space-y-5">
				{#if data.existingEntry}
					<input type="hidden" name="entry_id" value={data.existingEntry.id} />
				{/if}

				<!-- Hidden fields for cascading select values -->
				<input type="hidden" name="contract_id" value={selectedContractId} />
				<input type="hidden" name="deliverable_id" value={selectedDeliverableId} />
				<input type="hidden" name="work_type_id" value={selectedWorkTypeId} />

				<!-- Date -->
				<div>
					<label for="entry-date" class="block text-sm font-medium text-gray-700">
						Date
					</label>
					<input
						id="entry-date"
						name="date"
						type="date"
						bind:value={selectedDate}
						required
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<!-- Contract / Deliverable / Work Type -->
				<CascadingSelects
					bind:selectedContractId
					bind:selectedDeliverableId
					bind:selectedWorkTypeId
				/>

				<!-- Time Input Mode Toggle -->
				<div class="flex items-center gap-4">
					<button
						type="button"
						onclick={() => (useDurationInput = false)}
						class="text-sm {useDurationInput
							? 'text-gray-500 hover:text-gray-700'
							: 'font-medium text-blue-600'}"
					>
						Start / End Time
					</button>
					<span class="text-gray-300">|</span>
					<button
						type="button"
						onclick={() => (useDurationInput = true)}
						class="text-sm {useDurationInput
							? 'font-medium text-blue-600'
							: 'text-gray-500 hover:text-gray-700'}"
					>
						Manual Duration
					</button>
				</div>

				{#if useDurationInput}
					<div>
						<label for="manual-duration" class="block text-sm font-medium text-gray-700">
							Duration (hh:mm)
						</label>
						<input
							id="manual-duration"
							name="manual_duration"
							type="text"
							bind:value={manualDuration}
							placeholder="01:30"
							pattern={'[0-9]{1,2}:[0-9]{2}'}
							class="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
						<p class="mt-1 text-xs text-gray-500">Format: hours:minutes (e.g. 1:30 for 1h 30m)</p>
					</div>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="start-time" class="block text-sm font-medium text-gray-700">
								Start Time
							</label>
							<input
								id="start-time"
								name="start_time"
								type="time"
								bind:value={startTime}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							/>
						</div>
						<div>
							<label for="end-time" class="block text-sm font-medium text-gray-700">
								End Time
							</label>
							<input
								id="end-time"
								name="end_time"
								type="time"
								bind:value={endTime}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							/>
						</div>
					</div>
				{/if}

				<!-- Description -->
				<div>
					<label for="entry-description" class="block text-sm font-medium text-gray-700">
						Description
					</label>
					<textarea
						id="entry-description"
						name="description"
						bind:value={description}
						rows="3"
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="What did you work on?"
					></textarea>
				</div>

				<!-- Submit -->
				<div class="flex items-center justify-end gap-3">
					<a
						href="/"
						class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</a>
					<button
						type="submit"
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
					>
						{isEditing ? 'Update Entry' : 'Save Entry'}
					</button>
				</div>
			</form>
		</div>
	</main>
</div>
