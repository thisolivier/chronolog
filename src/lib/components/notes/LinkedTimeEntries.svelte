<script lang="ts">
	interface Props {
		noteId: string;
	}

	type LinkedTimeEntry = {
		noteId: string;
		timeEntryId: string;
		headingAnchor: string | null;
	};

	let { noteId }: Props = $props();
	let linkedEntries = $state<LinkedTimeEntry[]>([]);
	let isLoading = $state(false);

	async function fetchLinkedEntries() {
		isLoading = true;
		try {
			const response = await fetch(`/api/notes/${noteId}/time-entries`);
			if (response.ok) {
				const data = await response.json();
				linkedEntries = data.timeEntries;
			}
		} catch (fetchError) {
			console.error('Failed to fetch linked entries:', fetchError);
		} finally {
			isLoading = false;
		}
	}

	async function unlinkEntry(timeEntryId: string) {
		try {
			await fetch(`/api/notes/${noteId}/time-entries`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timeEntryId })
			});
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
			{#each linkedEntries as entry}
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
