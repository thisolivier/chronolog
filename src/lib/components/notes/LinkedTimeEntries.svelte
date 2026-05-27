<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import { formatDuration } from '$lib/utils/iso-week';
	import type { LinkedTimeEntryDisplay } from '$lib/services/types';

	interface Props {
		noteId: string;
	}

	const dataService = getDataService();

	let { noteId }: Props = $props();
	let linkedEntries = $state<LinkedTimeEntryDisplay[]>([]);

	async function fetchLinkedEntries() {
		try {
			linkedEntries = await dataService.getNoteTimeEntries(noteId);
		} catch (fetchError) {
			console.error('Failed to fetch linked entries:', fetchError);
		}
	}

	async function unlinkEntry(timeEntryId: string) {
		try {
			await dataService.unlinkNoteTimeEntry(noteId, timeEntryId);
			linkedEntries = linkedEntries.filter(
				(entry) => entry.timeEntryId !== timeEntryId
			);
		} catch (unlinkError) {
			console.error('Failed to unlink entry:', unlinkError);
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	$effect(() => {
		if (noteId) {
			fetchLinkedEntries();
		}
	});
</script>

{#if linkedEntries.length > 0}
	<div class="border-t border-stone-200 bg-white px-6 py-3">
		<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
			Linked Time Entries
		</h4>
		<div class="space-y-1">
			{#each linkedEntries as entry (entry.timeEntryId)}
				<div
					class="group flex items-start justify-between rounded px-2 py-1.5 hover:bg-stone-50"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-xs font-medium text-stone-500">
								{formatDate(entry.date)}
							</span>
							{#if entry.description}
								<span class="truncate text-sm text-stone-700">
									— {entry.description}
								</span>
							{/if}
						</div>
						<div class="text-xs text-stone-400">
							{entry.clientName} / {entry.contractName}
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<span class="text-xs text-stone-400">
							{formatDuration(entry.durationMinutes)}
						</span>
						<button
							onclick={() => unlinkEntry(entry.timeEntryId)}
							class="text-stone-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
							title="Unlink time entry"
						>
							&times;
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
