<!--
	Back / Forward through this tab's journey in the app (sprint 050-UI): the Mac app and the
	installed PWA have no browser buttons. `desktop` shows ‹ › before the global search field, the
	unavailable one disabled; `phone` shows only › next to the labelled "← Back", and only when
	there is something ahead. Both walk the in-app history (`navigation.goBack` / `goForward`), so
	they never leave the app, and both listen for Cmd+[ / Cmd+] and Alt+Left / Alt+Right.
-->
<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { requestNoteTitles } from '$lib/components/notes/note-titles.svelte';
	import { labelForPath, noteIdOfPath } from './navigation-labels';
	import { historyShortcutDirection } from './history-shortcuts';

	interface Props {
		variant?: 'desktop' | 'phone';
		class?: string;
	}

	let { variant = 'desktop', class: className = '' }: Props = $props();

	const navigation = getNavigationContext();

	// Note entries are labelled with the note's title once it is known (the cache is reactive)
	$effect(() => {
		const noteIds = [noteIdOfPath(navigation.previousPath), noteIdOfPath(navigation.nextPath)].filter(
			(noteId): noteId is string => noteId !== null
		);
		if (noteIds.length > 0) requestNoteTitles(noteIds);
	});

	const fallbackWeek = $derived(navigation.selectedWeek ?? '');
	const backLabel = $derived(
		navigation.previousPath ? `Back to ${labelForPath(navigation.previousPath, fallbackWeek)}` : 'Back'
	);
	const forwardLabel = $derived(
		navigation.nextPath ? `Forward to ${labelForPath(navigation.nextPath, fallbackWeek)}` : 'Forward'
	);

	function handleWindowKeydown(event: KeyboardEvent) {
		const direction = historyShortcutDirection(event);
		if (!direction) return;
		event.preventDefault();
		if (direction === 'back') navigation.goBack();
		else navigation.goForward();
	}

	const desktopButtonClass =
		'flex h-8 w-8 items-center justify-center rounded-md btn-quiet hover:text-ink disabled:cursor-default disabled:text-chalk-300 disabled:hover:bg-transparent';
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#snippet chevron(direction: 'back' | 'forward')}
	<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true">
		<path d={direction === 'back' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'} stroke-linecap="round" stroke-linejoin="round" />
	</svg>
{/snippet}

{#if variant === 'desktop'}
	<div class="flex flex-shrink-0 items-center {className}" data-testid="history-buttons">
		<button
			type="button"
			onclick={() => navigation.goBack()}
			disabled={!navigation.canGoBack}
			class={desktopButtonClass}
			aria-label={backLabel}
			title={backLabel}
			data-testid="history-back"
		>
			{@render chevron('back')}
		</button>
		<button
			type="button"
			onclick={() => navigation.goForward()}
			disabled={!navigation.canGoForward}
			class={desktopButtonClass}
			aria-label={forwardLabel}
			title={forwardLabel}
			data-testid="history-forward"
		>
			{@render chevron('forward')}
		</button>
	</div>
{:else if navigation.canGoForward}
	<button
		type="button"
		onclick={() => navigation.goForward()}
		class="flex h-11 w-8 flex-shrink-0 items-center justify-center rounded-md text-pine-600 hover:bg-chalk-100 hover:text-pine-800 {className}"
		aria-label={forwardLabel}
		title={forwardLabel}
		data-testid="mobile-forward"
	>
		{@render chevron('forward')}
	</button>
{/if}
