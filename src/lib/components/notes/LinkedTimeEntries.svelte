<!--
	"Linked Time Entries": time entries whose description links to this note.
	Each row opens that entry's week in time mode; wiki-links in the description show note
	titles and open the linked note.
	054-DR (NT-06): secondary and quiet ("Linked time · N", muted dates); an entry names its client /
	contract (with the contract mark) only when it is not the note's own contract. No timer controls.
-->
<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { formatDuration } from '$lib/utils/iso-week';
	import WikiLinkRenderer from '$lib/components/weekly/WikiLinkRenderer.svelte';
	import { useNoteNavigation } from './note-navigation';
	import type { LinkedTimeEntryDisplay } from '$lib/services/types';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
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
			linkedEntries = linkedEntries.filter((entry) => entry.timeEntryId !== timeEntryId);
		} catch (unlinkError) {
			console.error('Failed to unlink entry:', unlinkError);
		}
	}

	/** Show the entry's day: time mode, on the week that contains it */
	function openEntryDay(entry: LinkedTimeEntryDisplay) {
		navigation.showTimeEntryDay(entry.date);
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
	<div class="border-t border-divider bg-surface px-6 py-3" data-testid="linked-time-entries">
		<h4 class="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
			Linked time <span class="font-normal" aria-hidden="true">· {linkedEntries.length}</span>
		</h4>
		<div class="space-y-1">
			{#each linkedEntries as entry (entry.timeEntryId)}
				<div class="group flex items-start justify-between gap-2 rounded px-2 py-1.5 hover:bg-chalk-50">
					<div
						role="button"
						tabindex="0"
						class="min-w-0 flex-1 cursor-pointer"
						title="Open {formatDate(entry.date)} in Time Entries"
						data-testid="linked-time-entry"
						onclick={() => openEntryDay(entry)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								openEntryDay(entry);
							}
						}}
					>
						<div class="flex items-center gap-2">
							<!-- One line on a phone: the date never wraps into the description or duration (043) -->
							<span class="shrink-0 whitespace-nowrap text-xs font-medium text-ink-muted group-hover:underline" data-testid="linked-time-entry-date">
								{formatDate(entry.date)}
							</span>
							{#if entry.description}
								<span class="min-w-0 truncate text-sm text-ink-muted">
									— <WikiLinkRenderer
										text={entry.description}
										onNoteLinkClick={(linkedNoteId) => noteNavigation.openNoteById(linkedNoteId)}
									/>
								</span>
							{/if}
						</div>
						{#if isOtherContract(entry)}
							<div class="mt-0.5 flex min-w-0 items-center gap-mark-gap text-xs text-ink-faint" data-testid="linked-time-entry-contract">
								<ContractMark
									contractName={entry.contractName}
									contractId={entry.contractId}
									colorIndex={entry.clientColorIndex}
									size="sm"
								/>
								<span class="truncate">{entry.clientName} / {entry.contractName}</span>
							</div>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<span class="whitespace-nowrap text-xs text-ink-faint" data-testid="linked-time-entry-duration">
							{formatDuration(entry.durationMinutes)}
						</span>
						<button
							onclick={() => unlinkEntry(entry.timeEntryId)}
							class="text-chalk-300 opacity-0 transition-opacity hover:text-rust-500 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:text-ink-faint pointer-coarse:opacity-100"
							title="Unlink time entry"
							aria-label="Unlink time entry"
						>
							&times;
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
