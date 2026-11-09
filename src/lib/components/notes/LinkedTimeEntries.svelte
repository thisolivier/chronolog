<!--
	Linked time entries under the editor: time entries whose description links to this note.
	Each row (`LinkedTimeEntryRow.svelte`) opens that entry's week in time mode; wiki-links in the
	description show note titles and open the linked note.
	054-DR (NT-06): quiet, muted dates; an entry names its client / contract (with the contract mark)
	only when it is not the note's own contract. No timer controls.
	064-DR (N3): no heading (each row starts with a clock glyph and is named "Linked time entry" for
	screen readers); × asks "Unlink?" inline. Focus goes to Unlink when the question appears, back to
	the row's × on Cancel / Escape, and to the next row's × (or the previous one) after unlinking.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { getDataService } from '$lib/services/context';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { useNoteNavigation } from './note-navigation';
	import LinkedTimeEntryRow from './LinkedTimeEntryRow.svelte';
	import type { LinkedTimeEntryDisplay } from '$lib/services/types';
	import { contractDirectory } from '$lib/stores/contract-directory.svelte';

	interface Props {
		noteId: string;
		/** The note's own contract; entries on it do not repeat its name */
		noteContractId?: string | null;
	}

	const dataService = getDataService();
	const navigation = getNavigationContext();
	const noteNavigation = useNoteNavigation(navigation);

	let { noteId, noteContractId = null }: Props = $props();

	const noteContract = $derived(noteContractId ? contractDirectory.labels[noteContractId] : undefined);

	/** True when the entry's contract is not the note's (by ID; by names for older cached rows) */
	function isOtherContract(entry: LinkedTimeEntryDisplay): boolean {
		if (!noteContractId) return true;
		if (entry.contractId) return entry.contractId !== noteContractId;
		return !noteContract || entry.contractName !== noteContract.name || entry.clientName !== noteContract.clientName;
	}
	let linkedEntries = $state<LinkedTimeEntryDisplay[]>([]);
	/** The row whose × is asking "Unlink?" (one at a time) */
	let confirmingEntryId = $state<string | null>(null);
	let listElement = $state<HTMLElement | null>(null);

	async function fetchLinkedEntries() {
		try {
			linkedEntries = await dataService.getNoteTimeEntries(noteId);
		} catch (fetchError) {
			console.error('Failed to fetch linked entries:', fetchError);
		}
	}

	/** Focus a control of a row after the next render (`data-unlink-request` or `data-unlink-confirm`) */
	async function focusInRow(timeEntryId: string | undefined, control: 'data-unlink-request' | 'data-unlink-confirm') {
		await tick();
		if (!timeEntryId) return;
		listElement?.querySelector<HTMLElement>(`[data-time-entry-id="${CSS.escape(timeEntryId)}"] [${control}]`)?.focus();
	}

	function requestUnlink(timeEntryId: string) {
		confirmingEntryId = timeEntryId;
		void focusInRow(timeEntryId, 'data-unlink-confirm');
	}

	function cancelUnlink(timeEntryId: string) {
		confirmingEntryId = null;
		void focusInRow(timeEntryId, 'data-unlink-request');
	}

	async function confirmUnlink(timeEntryId: string) {
		confirmingEntryId = null;
		const entryIndex = linkedEntries.findIndex((entry) => entry.timeEntryId === timeEntryId);
		const neighbour = linkedEntries[entryIndex + 1] ?? linkedEntries[entryIndex - 1];
		try {
			await dataService.unlinkNoteTimeEntry(noteId, timeEntryId);
			linkedEntries = linkedEntries.filter((entry) => entry.timeEntryId !== timeEntryId);
			void focusInRow(neighbour?.timeEntryId, 'data-unlink-request');
		} catch (unlinkError) {
			console.error('Failed to unlink entry:', unlinkError);
			void focusInRow(timeEntryId, 'data-unlink-request');
		}
	}

	$effect(() => {
		if (noteId) {
			confirmingEntryId = null;
			fetchLinkedEntries();
		}
	});
</script>

{#if linkedEntries.length > 0}
	<div class="border-t border-divider bg-surface px-6 py-3" data-testid="linked-time-entries">
		<div class="space-y-1" role="group" aria-label="Linked time entries" bind:this={listElement}>
			{#each linkedEntries as entry (entry.timeEntryId)}
				<LinkedTimeEntryRow
					{entry}
					showContract={isOtherContract(entry)}
					isConfirmingUnlink={confirmingEntryId === entry.timeEntryId}
					onOpen={() => navigation.showTimeEntryDay(entry.date)}
					onOpenNote={(linkedNoteId) => noteNavigation.openNoteById(linkedNoteId)}
					onRequestUnlink={() => requestUnlink(entry.timeEntryId)}
					onConfirmUnlink={() => confirmUnlink(entry.timeEntryId)}
					onCancelUnlink={() => cancelUnlink(entry.timeEntryId)}
				/>
			{/each}
		</div>
	</div>
{/if}
