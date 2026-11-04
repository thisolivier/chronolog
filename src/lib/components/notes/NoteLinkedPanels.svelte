<!--
	NoteLinkedPanels — "Linked from", "Linked time entries" and "Attachments" under the editor.
	On a short screen (a phone in landscape, under 500 px tall; sprint 043-CL) they sit in a
	disclosure that starts closed, so the editor keeps the screen for writing; one tap opens them.
	The panels mount either way (they load their own data), and the disclosure hides itself when
	none of them has anything to show.
-->
<script lang="ts">
	import NoteBacklinks from './NoteBacklinks.svelte';
	import LinkedTimeEntries from './LinkedTimeEntries.svelte';
	import AttachmentList from './AttachmentList.svelte';
	import type { Backlink } from '$lib/services/types';

	let { noteId, backlinks, onOpenBacklink }: { noteId: string; backlinks: Backlink[]; onOpenBacklink: (backlink: Backlink) => void } =
		$props();

	const SHORT_SCREEN_QUERY = '(max-height: 500px)';
	let isShortScreen = $state(typeof matchMedia === 'function' && matchMedia(SHORT_SCREEN_QUERY).matches);

	$effect(() => {
		if (typeof matchMedia !== 'function') return;
		const query = matchMedia(SHORT_SCREEN_QUERY);
		const follow = () => (isShortScreen = query.matches);
		query.addEventListener('change', follow);
		return () => query.removeEventListener('change', follow);
	});
</script>

{#snippet panels()}
	<NoteBacklinks {backlinks} onOpen={onOpenBacklink} />
	<LinkedTimeEntries {noteId} />
	<AttachmentList {noteId} />
{/snippet}

{#if isShortScreen}
	<details class="linked-panels border-t border-stone-200 bg-white" data-testid="note-linked-panels">
		<summary class="cursor-pointer px-6 py-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
			Links and attachments
		</summary>
		{@render panels()}
	</details>
{:else}
	{@render panels()}
{/if}

<style>
	/* Nothing linked or attached: no empty disclosure */
	.linked-panels:not(:has([data-testid='note-backlinks'], [data-testid='linked-time-entries'], [data-testid='note-attachments'])) {
		display: none;
	}
</style>
