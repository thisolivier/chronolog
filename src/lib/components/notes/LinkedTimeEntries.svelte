<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import type { NoteTimeEntryLink } from '$lib/services/types';

	interface Props {
		noteId: string;
	}

	const dataService = getDataService();

	let { noteId }: Props = $props();
	let linkedEntries = $state<NoteTimeEntryLink[]>([]);

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

	$effect(() => {
		if (noteId) {
			fetchLinkedEntries();
		}
	});
</script>

{#if linkedEntries.length > 0}
	<div class="border-t border-gray-200 bg-white px-6 py-3">
		<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
			Linked Time Entries
		</h4>
		<div class="space-y-1">
			{#each linkedEntries as entry (entry.timeEntryId)}
				<div
					class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-50"
				>
					<span class="font-mono text-gray-500"
						>{entry.timeEntryId.slice(0, 8)}...</span
					>
					<button
						onclick={() => unlinkEntry(entry.timeEntryId)}
						class="text-gray-400 hover:text-red-500"
						title="Unlink time entry"
					>
						&times;
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}
