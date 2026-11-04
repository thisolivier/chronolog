<!--
	OutboxHeldPanel — the changes made offline that need a decision (sprint 045-CL), opened from
	the offline banner. Each held item shows the server's version beside this device's and asks:
	keep mine, keep the server's, or for a note keep both (mine becomes a new note). A change the
	server refused can be tried again or discarded. Nothing is dropped without one of these clicks.
-->
<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { peekCachedRead } from '$lib/services/fetch-helpers';
	import type { NoteDetail } from '$lib/services/types';
	import { outbox } from './outbox-store.svelte';
	import { scheduleReplay } from './offline-session.svelte';
	import { myNoteText, OUTBOX_RESOLVED_EVENT, resolveHeldItem, serverNoteText, type HoldChoice } from './outbox-resolve';
	import { ENTRY_GROUPS } from './outbox-merge';
	import { previewLines } from './outbox-projection';
	import type { OutboxItem } from './outbox-types';

	let { onClose }: { onClose: () => void } = $props();

	const dataService = getDataService();
	const navigation = getNavigationContext();
	let busySequence = $state<number | null>(null);
	let actionError = $state('');

	const GROUP_LABELS: Record<string, string> = {
		title: 'Title',
		content: 'Text',
		time: 'Time',
		date: 'Date',
		description: 'Description',
		references: 'Contract, deliverable and work type'
	};

	function itemType(item: OutboxItem): 'note' | 'entry' {
		return item.kind.startsWith('note-') ? 'note' : 'entry';
	}

	function itemId(item: OutboxItem): string {
		if (item.kind === 'note-update') return item.noteId;
		if (item.kind === 'note-create') return item.realId ?? item.tempId;
		if (item.kind === 'entry-create') return item.tempId;
		return item.entryId;
	}

	function heading(item: OutboxItem): string {
		const mine = myNoteText(item);
		if (mine) {
			const firstLine = mine.fields.title || previewLines(mine.fields).firstLine;
			return `Note “${firstLine || mine.noteId}”`;
		}
		const server = item.hold?.server as Record<string, unknown> | null | undefined;
		const description =
			(item.kind === 'entry-update' ? item.changes.description : undefined) ??
			(item.kind === 'entry-create' ? item.input.description : undefined) ??
			(server?.description as string | undefined);
		const date = (item.kind === 'entry-create' ? item.input.date : undefined) ?? (server?.date as string | undefined) ?? '';
		return `Time entry ${date}${description ? `: ${description}` : ''}`;
	}

	/** The text a note version shows: its title when only the title clashed, else its markdown */
	function versionText(source: Record<string, unknown> | null | undefined, conflictFields: string[] | undefined): string {
		if (!source) return '';
		const titleOnly = conflictFields?.length === 1 && conflictFields[0] === 'title';
		return String((titleOnly ? source.title : source.content) ?? '');
	}

	function entryValue(source: Record<string, unknown> | null | undefined, group: string): string {
		if (!source) return '—';
		const values = ENTRY_GROUPS[group].map((field) => source[field]).filter((value) => value !== undefined && value !== null && value !== '');
		return values.length > 0 ? values.join(' · ') : '—';
	}

	function myEntryValues(item: OutboxItem): Record<string, unknown> | null {
		if (item.kind === 'entry-update') return item.changes as Record<string, unknown>;
		if (item.kind === 'entry-create') return item.input as Record<string, unknown>;
		return null;
	}

	function resolve(item: OutboxItem, choice: HoldChoice) {
		outbox.update((state) => resolveHeldItem(state, item.sequence, choice));
		window.dispatchEvent(new CustomEvent(OUTBOX_RESOLVED_EVENT, { detail: { type: itemType(item), id: itemId(item), choice } }));
		if (choice !== 'server') scheduleReplay(0);
	}

	/** Mine becomes a new note in the same contract; the server's copy stays as it is */
	async function keepBoth(item: OutboxItem) {
		const mine = myNoteText(item);
		if (!mine) return;
		const contractId =
			(item.kind === 'note-create' ? item.contractId : undefined) ??
			serverNoteText(item)?.contractId ??
			peekCachedRead<{ note: NoteDetail }>(`/api/notes/${mine.noteId}`)?.note.contractId;
		if (!contractId) {
			actionError = 'The contract of this note is unknown here; keep the server’s copy or yours instead.';
			return;
		}
		busySequence = item.sequence;
		actionError = '';
		try {
			const created = await dataService.createNote(contractId, mine.fields);
			resolve(item, 'server');
			onClose();
			navigation.openNote(created.id, contractId, '');
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Could not save your version as a new note';
		} finally {
			busySequence = null;
		}
	}

	const buttonClass = 'rounded border px-2.5 py-1 text-xs font-medium disabled:opacity-50';
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" role="presentation">
	<div
		class="w-full max-w-3xl rounded-lg bg-white p-4 shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="outbox-held-title"
		data-testid="outbox-held-panel"
	>
		<div class="mb-3 flex items-center justify-between gap-2">
			<h2 id="outbox-held-title" class="text-base font-semibold text-stone-900">Changes that need your decision</h2>
			<button type="button" class="rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100" onclick={onClose} aria-label="Close">&times;</button>
		</div>
		{#if actionError}
			<p class="mb-2 text-sm text-red-600" role="alert">{actionError}</p>
		{/if}
		{#if outbox.heldItems.length === 0}
			<p class="text-sm text-stone-600">Nothing is waiting for a decision.</p>
		{/if}
		<ul class="space-y-4">
			{#each outbox.heldItems as item (item.sequence)}
				{@const mine = myNoteText(item)}
				{@const server = item.hold?.server as Record<string, unknown> | null | undefined}
				<li class="rounded border border-stone-200 p-3" data-testid="outbox-held-item">
					<h3 class="truncate text-sm font-semibold text-stone-900">{heading(item)}</h3>
					<p class="mb-2 text-xs text-stone-600">{item.hold?.message}</p>
					{#if item.hold?.reason === 'conflict' && mine}
						<div class="grid gap-2 sm:grid-cols-2">
							<div>
								<p class="mb-1 text-xs font-medium text-stone-500">On the server</p>
								<pre class="max-h-60 overflow-auto rounded bg-stone-50 p-2 text-xs whitespace-pre-wrap" data-testid="held-server-version">{versionText(server, item.hold?.conflictFields)}</pre>
							</div>
							<div>
								<p class="mb-1 text-xs font-medium text-stone-500">Yours (this device)</p>
								<pre class="max-h-60 overflow-auto rounded bg-amber-50 p-2 text-xs whitespace-pre-wrap" data-testid="held-my-version">{versionText(mine.fields, item.hold?.conflictFields)}</pre>
							</div>
						</div>
					{:else if item.hold?.reason === 'conflict'}
						<table class="w-full text-left text-xs">
							<thead><tr class="text-stone-500"><th class="py-1 pr-2 font-medium"></th><th class="py-1 pr-2 font-medium">On the server</th><th class="py-1 font-medium">Yours</th></tr></thead>
							<tbody>
								{#each item.hold.conflictFields ?? [] as group (group)}
									<tr class="border-t border-stone-100">
										<td class="py-1 pr-2 text-stone-500">{GROUP_LABELS[group] ?? group}</td>
										<td class="py-1 pr-2">{entryValue(server, group)}</td>
										<td class="py-1">{item.kind === 'entry-delete' ? 'deleted' : entryValue(myEntryValues(item), group)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else if mine}
						<pre class="max-h-60 overflow-auto rounded bg-amber-50 p-2 text-xs whitespace-pre-wrap" data-testid="held-my-version">{mine.fields.content ?? ''}</pre>
					{/if}
					<div class="mt-2 flex flex-wrap gap-2">
						{#if item.hold?.reason === 'conflict'}
							<button type="button" class="{buttonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700" disabled={busySequence !== null} onclick={() => resolve(item, 'mine')}>Keep mine</button>
							<button type="button" class="{buttonClass} border-stone-300 text-stone-700 hover:bg-stone-50" disabled={busySequence !== null} onclick={() => resolve(item, 'server')}>Keep the server’s</button>
							{#if mine}
								<button type="button" class="{buttonClass} border-stone-300 text-stone-700 hover:bg-stone-50" disabled={busySequence !== null} onclick={() => keepBoth(item)}>Keep both (mine as a new note)</button>
							{/if}
						{:else}
							{#if mine && server === null}
								<button type="button" class="{buttonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700" disabled={busySequence !== null} onclick={() => keepBoth(item)}>Save mine as a new note</button>
							{/if}
							<button type="button" class="{buttonClass} border-stone-300 text-stone-700 hover:bg-stone-50" disabled={busySequence !== null} onclick={() => resolve(item, 'retry')}>Try again</button>
							<button type="button" class="{buttonClass} border-red-300 text-red-700 hover:bg-red-50" disabled={busySequence !== null} onclick={() => resolve(item, 'server')}>Discard mine</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
</div>
